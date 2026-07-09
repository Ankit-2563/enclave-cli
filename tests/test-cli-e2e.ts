import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import axios from "axios";
import crypto from "crypto";
import { prisma } from "../../server/src/lib/prisma.js";
import { getToken } from "../src/utils/auth.js";

const serverCwd = "../server";
const cliCwd = ".";

function runProcess(cmd: string, args: string[], cwd: string, envOverrides: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...envOverrides },
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

async function run() {
  console.log("Starting Enclave CLI E2E Verification Tests...");

  // 1. Start backend server in the background
  console.log("Spawning Express server in the background...");
  const serverProc = spawn("npx", ["tsx", "src/app.ts"], {
    cwd: serverCwd,
    env: { ...process.env, PORT: "4000", NODE_ENV: "development" },
  });

  // Wait for server to become ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      serverProc.kill();
      reject(new Error("Timeout waiting for server to start"));
    }, 15000);

    serverProc.stdout.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Enclave backend running on port 4000")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    serverProc.stderr.on("data", (data) => {
      console.log(`[Server Error Log] ${data.toString().trim()}`);
    });
  });
  console.log("Backend Server is ready on port 4000!");

  // Pipe all standard logs from server for troubleshooting
  serverProc.stdout.on("data", (data) => {
    console.log(`[Server Log] ${data.toString().trim()}`);
  });
  serverProc.stderr.on("data", (data) => {
    console.log(`[Server Error Log] ${data.toString().trim()}`);
  });

  // Create test user in DB to login
  const testUser = await prisma.user.upsert({
    where: { email: "cli-e2e-user@example.com" },
    update: {},
    create: { email: "cli-e2e-user@example.com", name: "CLI E2E User" },
  });

  // Delete any orphaned records from previous aborted test runs
  await prisma.personalAccessToken.deleteMany({ where: { userId: testUser.id } });
  await prisma.project.deleteMany({ where: { ownerId: testUser.id } });

  // Start "node dist/index.js login" and simulate browser redirect
  console.log("\nTesting 'enclave login'...");
  const loginProc = spawn("node", ["dist/index.js", "login"], { cwd: cliCwd });

  let loginSucceeded = false;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      loginProc.kill();
      reject(new Error("Timeout waiting for login flow"));
    }, 10000);

    loginProc.stdout.on("data", async (data) => {
      const output = data.toString();
      const match = output.match(/port=(\d+)/);
      if (match) {
        const port = match[1];
        console.log(`CLI login listening on local port: ${port}`);
        
        const mockPat = "env_pat_test_cli_e2e_token_123456789";
        try {
          await axios.get(`http://localhost:${port}/callback?token=${mockPat}`);
          loginSucceeded = true;
          clearTimeout(timeout);
          resolve();
        } catch (e: any) {
          console.error("Failed to call CLI callback:", e.message);
          reject(e);
        }
      }
    });
  });

  await new Promise<void>((resolve) => {
    loginProc.on("close", () => resolve());
  });

  const savedToken = getToken();
  console.log("Token retrieved from CLI storage:", savedToken);

  if (loginSucceeded && savedToken === "env_pat_test_cli_e2e_token_123456789") {
    console.log("SUCCESS: 'enclave login' authenticated successfully!");
  } else {
    console.error("FAILED: 'enclave login' authentication failed.");
    serverProc.kill();
    process.exit(1);
  }

  // Inject token in database so API will recognize it
  const tokenHash = crypto.createHash("sha256").update(savedToken!).digest("hex");
  await prisma.personalAccessToken.upsert({
    where: { tokenHash },
    update: { userId: testUser.id },
    create: {
      userId: testUser.id,
      name: "CLI E2E Test Token",
      tokenHash,
    },
  });

  // 2. Setup project config (simulate enclave init)
  console.log("\nTesting CLI project configuration...");
  const projectResponse = await axios.post("http://localhost:4000/api/projects",
    { name: "CLI E2E Test Project" },
    { headers: { Authorization: `Bearer ${savedToken}` } }
  );
  const project = projectResponse.data;
  const devEnv = project.environments.find((e: any) => e.name === "development");

  const configDir = path.join(cliCwd, ".enc");
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir);
  const configPath = path.join(configDir, "config.json");
  fs.writeFileSync(configPath, JSON.stringify({
    projectId: project.id,
    environmentId: devEnv.id,
    environmentName: devEnv.name,
  }, null, 2), "utf8");
  console.log("Project initialized at .enc/config.json");

  // 3. Test 'enclave push'
  console.log("\nTesting 'enclave push'...");
  const envPath = path.join(cliCwd, ".env");
  fs.writeFileSync(envPath, "HELLO_WORLD=from_cli_env\nPORT=3333\n", "utf8");

  const pushRes = await runProcess("node", ["dist/index.js", "push"], cliCwd);
  console.log(pushRes.stdout);
  if (pushRes.code !== 0) {
    console.error("FAILED: 'enclave push' exited with code:", pushRes.code);
    console.error(pushRes.stderr);
    serverProc.kill();
    process.exit(1);
  }
  console.log("SUCCESS: 'enclave push' completed.");

  // Verify secrets are saved encrypted in DB
  const dbSecrets = await prisma.secret.findMany({
    where: { environmentId: devEnv.id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  console.log(`Pushed Secrets Count in DB: ${dbSecrets.length}`);
  for (const s of dbSecrets) {
    console.log(`  Secret "${s.key}": encryptedValue=${s.versions[0].encryptedValue}`);
    if (s.versions[0].encryptedValue.includes("from_cli_env")) {
      console.error("FAILED: Database stores plaintext secret!");
      serverProc.kill();
      process.exit(1);
    }
  }

  // 4. Test 'enclave pull'
  console.log("\nTesting 'enclave pull'...");
  fs.unlinkSync(envPath);
  
  const pullRes = await runProcess("node", ["dist/index.js", "pull"], cliCwd);
  console.log(pullRes.stdout);
  if (pullRes.code !== 0) {
    console.error("FAILED: 'enclave pull' exited with code:", pullRes.code);
    serverProc.kill();
    process.exit(1);
  }

  const pulledEnv = fs.readFileSync(envPath, "utf8");
  console.log("Pulled .env contents:\n" + pulledEnv);
  if (!pulledEnv.includes("HELLO_WORLD=from_cli_env") || !pulledEnv.includes("PORT=3333")) {
    console.error("FAILED: Pulled .env contents do not match expected values.");
    serverProc.kill();
    process.exit(1);
  }
  console.log("SUCCESS: 'enclave pull' successfully decrypted secrets.");

  // 5. Test 'enclave run'
  console.log("\nTesting 'enclave run'...");
  const scriptPath = path.join(cliCwd, "cli-run-test-script.js");
  const outputPath = path.join(cliCwd, "run-output.txt");
  if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  // Write temporary test script
  fs.writeFileSync(scriptPath, `
    import fs from 'fs';
    fs.writeFileSync('run-output.txt', process.env.HELLO_WORLD + '_' + process.env.PORT);
  `, "utf8");

  const runRes = await runProcess(
    "node",
    ["dist/index.js", "run", "--", "node", "cli-run-test-script.js"],
    cliCwd
  );
  
  if (runRes.code !== 0 || !fs.existsSync(outputPath)) {
    console.error("FAILED: 'enclave run' command did not complete successfully or write output file.");
    console.error("runRes exit code:", runRes.code);
    console.error("runRes stdout:", runRes.stdout);
    console.error("runRes stderr:", runRes.stderr);
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
    serverProc.kill();
    process.exit(1);
  }

  const runOutputVal = fs.readFileSync(outputPath, "utf8").trim();
  console.log("Run command output written to file:", runOutputVal);
  if (runOutputVal !== "from_cli_env_3333") {
    console.error("FAILED: 'enclave run' did not inject environment variables correctly.");
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    serverProc.kill();
    process.exit(1);
  }
  console.log("SUCCESS: 'enclave run' injected secrets in-memory successfully.");
  if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  // 6. Test 'enclave revert'
  console.log("\nTesting 'enclave revert'...");
  fs.writeFileSync(envPath, "HELLO_WORLD=from_cli_env\nPORT=4444\n", "utf8");
  await runProcess("node", ["dist/index.js", "push"], cliCwd);

  const revertRes = await runProcess("node", ["dist/index.js", "revert", "--key", "PORT", "--ver", "1"], cliCwd);
  console.log(revertRes.stdout);
  if (revertRes.code !== 0) {
    console.error("FAILED: 'enclave revert' failed to run.");
    serverProc.kill();
    process.exit(1);
  }

  await runProcess("node", ["dist/index.js", "pull"], cliCwd);
  const pulledEnvPostRevert = fs.readFileSync(envPath, "utf8");
  console.log("Pulled .env contents after revert:\n" + pulledEnvPostRevert);
  if (!pulledEnvPostRevert.includes("PORT=3333")) {
    console.error("FAILED: Revert did not restore PORT to 3333.");
    serverProc.kill();
    process.exit(1);
  }
  console.log("SUCCESS: 'enclave revert' restored secret successfully.");

  // Cleanup project and test data
  console.log("\nCleaning up test data...");
  serverProc.kill();
  await prisma.personalAccessToken.deleteMany({ where: { userId: testUser.id } });
  await prisma.project.deleteMany({ where: { ownerId: testUser.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
  if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true, force: true });

  console.log("All CLI integration tests passed successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("E2E verification test runner failed:", err);
  process.exit(1);
});
