import { execSync } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import chalk from "chalk";

const ENCLAVE_DIR = path.join(os.homedir(), ".enclave");
const AUTH_FILE = path.join(ENCLAVE_DIR, "auth.json");

const SERVICE_NAME = "enclave-cli";
const ACCOUNT_NAME = "enclave";

/**
 * Attempts to store token in native OS keychain.
 */
function setKeychain(token: string): boolean {
  try {
    const platform = os.platform();
    if (platform === "darwin") {
      execSync(`security add-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" -w "${token}" -U 2>/dev/null`);
      return true;
    } else if (platform === "win32") {
      execSync(`cmdkey /generic:${SERVICE_NAME} /user:${ACCOUNT_NAME} /pass:"${token}" 2>/dev/null`);
      return true;
    } else if (platform === "linux") {
      execSync(`echo -n "${token}" | secret-tool store --label="Enclave CLI" service ${SERVICE_NAME} account ${ACCOUNT_NAME} 2>/dev/null`);
      return true;
    }
  } catch {}
  return false;
}

/**
 * Attempts to retrieve token from native OS keychain.
 */
function getKeychain(): string | null {
  try {
    const platform = os.platform();
    if (platform === "darwin") {
      const output = execSync(`security find-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" -w 2>/dev/null`);
      return output.toString().trim() || null;
    } else if (platform === "win32") {
      const command = `powershell -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Net'); $cred = [System.Net.CredentialCache]::GetCredential('${SERVICE_NAME}', '${ACCOUNT_NAME}'); if ($cred) { $cred.Password }"`;
      const output = execSync(command, { stdio: ["ignore", "pipe", "ignore"] });
      return output.toString().trim() || null;
    } else if (platform === "linux") {
      const output = execSync(`secret-tool lookup service ${SERVICE_NAME} account ${ACCOUNT_NAME} 2>/dev/null`);
      return output.toString().trim() || null;
    }
  } catch {}
  return null;
}

/**
 * Attempts to delete token from native OS keychain.
 */
function deleteKeychain(): boolean {
  try {
    const platform = os.platform();
    if (platform === "darwin") {
      execSync(`security delete-generic-password -a "${ACCOUNT_NAME}" -s "${SERVICE_NAME}" 2>/dev/null`);
      return true;
    } else if (platform === "win32") {
      execSync(`cmdkey /delete:${SERVICE_NAME} 2>/dev/null`);
      return true;
    } else if (platform === "linux") {
      execSync(`secret-tool clear service ${SERVICE_NAME} account ${ACCOUNT_NAME} 2>/dev/null`);
      return true;
    }
  } catch {}
  return false;
}

/**
 * Saves the authentication token to the OS keychain, falling back to a secure file (0600).
 */
export function saveToken(token: string): void {
  const saved = setKeychain(token);
  if (saved) {
    if (fs.existsSync(AUTH_FILE)) {
      try {
        fs.unlinkSync(AUTH_FILE);
      } catch {}
    }
    return;
  }

  if (process.env.ENCLAVE_STRICT === "1") {
    console.error(
      chalk.red(
        "\n❌ ERROR: OS Keychain is unavailable, and ENCLAVE_STRICT is enabled.\n" +
        "Refusing fallback to plaintext storage on disk. Exiting.\n"
      )
    );
    process.exit(1);
  }

  console.warn(
    chalk.yellow(
      "\n⚠️  WARNING: OS Keychain is unavailable. Falling back to storing token in plaintext at:\n" +
      `   ${AUTH_FILE}\n` +
      "  To avoid plaintext storage, set up your OS keychain, or set the ENCLAVE_API_TOKEN environment variable.\n"
    )
  );

  fs.mkdirSync(ENCLAVE_DIR, { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ token }), { mode: 0o600 });
}

/**
 * Retrieves the authentication token from OS keychain, falling back to the secure file.
 */
export function getToken(): string | null {
  if (process.env.ENCLAVE_API_TOKEN) {
    return process.env.ENCLAVE_API_TOKEN;
  }
  const token = getKeychain();
  if (token) {
    return token;
  }
  if (!fs.existsSync(AUTH_FILE)) {
    return null;
  }
  try {
    console.warn(
      chalk.yellow(
        `\n⚠️  WARNING: Using plaintext token from fallback storage at:\n` +
        `   ${AUTH_FILE}\n`
      )
    );
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    return data.token || null;
  } catch (e) {
    return null;
  }
}

/**
 * Deletes the authentication token from both the keychain and the fallback file.
 */
export function deleteToken(): void {
  deleteKeychain();
  if (fs.existsSync(AUTH_FILE)) {
    try {
      fs.unlinkSync(AUTH_FILE);
    } catch {}
  }
}
