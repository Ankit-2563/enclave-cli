import { spawn } from "child_process";
import chalk from "chalk";
import ora from "ora";
import api from "../utils/api.js";
import { requireConfig } from "../utils/config.js";

/**
 * Pulls secrets from the Enclave server directly into memory and spawns
 * the target command with those secrets injected as environment variables.
 */
export async function runCommand(args: string[]) {
  const config = requireConfig();

  if (!config.environmentId) {
    console.error(chalk.red("Error: No active environment branch set."));
    console.log(chalk.dim("Please specify an environment branch to pull first (e.g. enc pull development) before running commands."));
    process.exit(1);
  }

  if (!args || args.length === 0) {
    console.error(chalk.red("Error: No command specified. Usage: enclave run -- <command>"));
    process.exit(1);
  }

  const spinner = ora("Injecting Enclave secrets...").start();

  try {
    const { data } = await api.get(`/environments/${config.environmentId}/secrets`);
    spinner.stop();

    // Map secrets to object
    const secretsMap: Record<string, string> = {};
    for (const secret of data.secrets) {
      secretsMap[secret.key] = secret.value;
    }

    const childEnv = { ...process.env, ...secretsMap };
    
    const [executable, ...cmdArgs] = args;

    // Spawn child process with inherited stdio and injected environment
    const child = spawn(executable, cmdArgs, {
      stdio: "inherit",
      env: childEnv,
      shell: true,
    });

    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });

    child.on("error", (err) => {
      console.error(chalk.red(`Failed to start child process: ${err.message}`));
      process.exit(1);
    });
  } catch (err: any) {
    spinner.stop();
    console.error(chalk.red(`Failed to fetch secrets: ${err.response?.data?.error || err.message}`));
    process.exit(1);
  }
}
