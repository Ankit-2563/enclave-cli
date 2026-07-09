import fs from "fs";
import path from "path";
import chalk from "chalk";
import dotenv from "dotenv";
import api from "../utils/api.js";
import { Environment, requireConfig, writeConfig, readState, writeState } from "../utils/config.js";
import ora from "ora";

export async function pushCommand() {
  const config = requireConfig();

  if (!config.environmentId) {
    const resolveSpinner = ora("Fetching project environments...").start();
    let envs: Environment[] = [];
    try {
      const { data } = await api.get(`/projects/${config.projectId}/environments`);
      envs = data;
      resolveSpinner.stop();
    } catch (err: any) {
      resolveSpinner.stop();
      console.error(chalk.red(`Failed to fetch environments: ${err.message}`));
      process.exit(1);
    }

    if (envs.length === 0) {
      console.error(chalk.red("Error: No environments found in this project. Please create one on the dashboard."));
      process.exit(1);
    }

    let selectedEnv: Environment;
    if (envs.length === 1) {
      selectedEnv = envs[0];
      console.log(chalk.blue(`Auto-selecting the only available environment: "${selectedEnv.name}"`));
    } else {
      try {
        const { select } = await import("@inquirer/prompts");
        const selectedId = await select({
          message: "Select the environment to push to:",
          choices: envs.map((e) => ({
            name: e.name,
            value: e.id,
          })),
        });
        selectedEnv = envs.find((e) => e.id === selectedId)!;
      } catch (err) {
        console.error(chalk.red("\nError: Push canceled. Please select an environment."));
        process.exit(1);
      }
    }

    config.environmentId = selectedEnv.id;
    config.environmentName = selectedEnv.name;
    writeConfig(config);
  }

  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.error(chalk.red("Error: Local .env file not found in the current directory."));
    process.exit(1);
  }

  // Load lastPulledAt for conflict check (fast-forward prevention)
  const state = readState();
  const lastPulledAt = state?.lastPulledAt ?? new Date(0).toISOString();
  if (!state?.lastPulledAt) {
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

    spinner.stop();
    console.log(chalk.green("Secrets pushed successfully!"));
    
    // Print structural changes
    console.log(chalk.bold("\nPush Summary:"));
    console.log(`  ${chalk.green(`+ Added: ${data.added.length}`)}`);
    console.log(`  ${chalk.blue(`~ Updated: ${data.updated.length}`)}`);
    console.log(`  ${chalk.red(`- Deleted: ${data.deleted.length}`)}`);
    
    if (data.added.length > 0) console.log(chalk.dim(`    Added: ${data.added.join(", ")}`));
    if (data.updated.length > 0) console.log(chalk.dim(`    Updated: ${data.updated.join(", ")}`));
    if (data.deleted.length > 0) console.log(chalk.dim(`    Deleted: ${data.deleted.join(", ")}`));
  } catch (err: any) {
    spinner.stop();
    if (err.response?.status === 409) {
      console.error(chalk.red("Push rejected: Concurrency conflict detected."));
      console.log(chalk.yellow("\nAnother team member has pushed updates since your last pull."));
      console.log(`Please run ${chalk.cyan("enclave pull")} to merge changes first.`);
    } else {
      console.error(chalk.red(`Failed to push secrets: ${err.response?.data?.error || err.message}`));
    }
    process.exit(1);
  }
}
