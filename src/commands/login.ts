import http from "http";
import { AddressInfo } from "net";
import open from "open";
import chalk from "chalk";
import { saveToken } from "../utils/auth.js";
import ora from "ora";

// Production server URL — override via ENCLAVE_SERVER_URL for self-hosted instances
const DEFAULT_SERVER_URL = "https://enclaveapi.ankitbhavarthe.xyz";

/**
 * Initiates browser-based OAuth authentication flow for the CLI, or saves a direct token.
 */
export async function loginCommand(options: { provider?: string; token?: string }) {
  if (options.token) {
    const token = options.token.trim();
    if (!token.startsWith("env_pat_")) {
      console.log(chalk.red("Error: Invalid token format. Personal Access Tokens must start with 'env_pat_'."));
      process.exit(1);
    }
    const spinner = ora("Saving personal access token...").start();
    try {
      saveToken(token);
      spinner.stop();
      console.log(chalk.green("Authentication successful! Token saved securely."));
      process.exit(0);
    } catch (err: any) {
      spinner.stop();
      console.error(chalk.red(`Failed to save token: ${err.message}`));
      process.exit(1);
    }
  }

  const provider = options.provider || "google";
  console.log(chalk.bold(`Logging into Enclave via ${provider === "github" ? "GitHub" : "Google"}...`));

  const spinner = ora("Starting local authentication server...").start();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    
    if (url.pathname === "/callback") {
      const token = url.searchParams.get("token");

      if (!token) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Authentication Failed</h1><p>No token provided by the server.</p>");
        spinner.stop();
        console.error(chalk.red("Authentication failed: No token received."));
        server.close();
        process.exit(1);
      }

      saveToken(token);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f8fafc; color: #0f172a; margin: 0;">
            <div style="text-align: center; padding: 40px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05); max-width: 400px;">
              <h1 style="color: #10b981; margin-top: 0; font-size: 24px; font-weight: 600;">Enclave CLI Authenticated!</h1>
              <p style="color: #475569; font-size: 15px; line-height: 1.5;">You can now close this browser tab and return to your terminal.</p>
            </div>
          </body>
        </html>
      `);

      spinner.stop();
      console.log(chalk.green("Authentication successful! Token saved securely."));
      server.close(() => {
        process.exit(0);
      });
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  // Listen on port 0 to let OS allocate any available port
  server.listen(0, "localhost", () => {
    const port = (server.address() as AddressInfo).port;
    const serverUrl = process.env.ENCLAVE_SERVER_URL || DEFAULT_SERVER_URL;
    const authUrl = `${serverUrl}/auth/cli-login?port=${port}&provider=${provider}`;

    console.log(chalk.cyan(`\nTo authenticate, please open the following URL in your browser:\n`));
    console.log(chalk.bold.underline.cyan(authUrl));
    console.log();

    spinner.text = `Waiting for authentication callback...`;
    
    open(authUrl).catch(() => {
      // Ignore browser open errors as URL is already printed
    });
  });
}

