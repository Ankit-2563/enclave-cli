import fs from "fs";
import path from "path";
import chalk from "chalk";
import dotenv from "dotenv";
import api from "../utils/api.js";
import { readConfig, readState, writeState } from "../utils/config.js";
import { ora, stopFailure, stopSuccess } from "../utils/spinner.js";

/**
 * Reads local .env file, diffs against the server, and pushes secrets.
 */
export async function pushCommand() {
  const config = readConfig();
  if (!config) {
    console.error(chalk.red("Error: Project config not found. Please run 'enc init' first."));
    process.exit(1);
  }

  if (!config.environmentId) {
    console.error(chalk.red("Error: No active environment branch set."));
    console.log(chalk.dim("Please specify an environment branch to pull first (e.g. enc pull development) before pushing."));
    process.exit(1);
  }

  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.error(chalk.red("Error: Local .env file not found in the current directory."));
    process.exit(1);
  }

  // Load lastPulledAt for conflict check (fast-forward prevention)
  const state = readState();
  let lastPulledAt = new Date(0).toISOString();
  if (state?.lastPulledAt) {
    lastPulledAt = state.lastPulledAt;
  } else {
    console.log(chalk.yellow("Warning: No sync state found. Forcing push (conflict check may fail)."));
  }

  const spinner = ora("Pushing secrets to Enclave...").start();

  try {
    const envContent = fs.readFileSync(envPath);
    const parsed = dotenv.parse(envContent);
    const secrets = Object.entries(parsed).map(([key, value]) => ({ key, value }));

    const { data } = await api.post(`/environments/${config.environmentId}/secrets/push`, {
      secrets,
      lastPulledAt,
    });

    writeState({ lastPulledAt: new Date().toISOString() });

    stopSuccess(spinner, "Secrets pushed successfully!");
    
    // Print structural changes
    console.log(chalk.bold("\nPush Summary:"));
    console.log(`  ${chalk.green(`+ Added: ${data.added.length}`)}`);
    console.log(`  ${chalk.blue(`~ Updated: ${data.updated.length}`)}`);
    console.log(`  ${chalk.red(`- Deleted: ${data.deleted.length}`)}`);
    
    if (data.added.length > 0) console.log(chalk.dim(`    Added: ${data.added.join(", ")}`));
    if (data.updated.length > 0) console.log(chalk.dim(`    Updated: ${data.updated.join(", ")}`));
    if (data.deleted.length > 0) console.log(chalk.dim(`    Deleted: ${data.deleted.join(", ")}`));
  } catch (err: any) {
    if (err.response?.status === 409) {
      stopFailure(spinner, "Push rejected: Concurrency conflict detected.");
      console.log(chalk.yellow("\nAnother team member has pushed updates since your last pull."));
      console.log(`Please run ${chalk.cyan("enclave pull")} to merge changes first.`);
    } else {
      stopFailure(spinner, `Failed to push secrets: ${err.response?.data?.error || err.message}`);
    }
    process.exit(1);
  }
}
