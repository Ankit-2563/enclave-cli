import fs from "fs";
import path from "path";
import chalk from "chalk";
import api from "../utils/api.js";
import { Environment, requireConfig, writeConfig, writeState } from "../utils/config.js";
import ora from "ora";

interface PullOptions {
  development?: boolean;
  staging?: boolean;
  production?: boolean;
}

/**
 * Pulls environment secrets from Enclave and writes them to a local .env file.
 */
export async function pullCommand(envNameArg?: string, options: PullOptions = {}) {
  const config = requireConfig();

  // Resolve short flags to environment names
  if (!envNameArg) {
    if (options.development) envNameArg = "development";
    else if (options.staging) envNameArg = "staging";
    else if (options.production) envNameArg = "production";
  }

  let targetEnvId = config.environmentId;
  let targetEnvName = config.environmentName;

  if (envNameArg) {
    const spinner = ora(`Finding environment "${envNameArg}"...`).start();
    try {
      const { data: envs } = await api.get(`/projects/${config.projectId}/environments`);
      const found = (envs as Environment[]).find(
        (e) => e.name.toLowerCase() === envNameArg.toLowerCase()
      );
      
      if (!found) {
        spinner.stop();
        console.error(chalk.red(`Environment "${envNameArg}" not found in this project.`));
        process.exit(1);
      }
      
      targetEnvId = found.id;
      targetEnvName = found.name;

      // Save as active branch
      writeConfig({ ...config, environmentId: targetEnvId, environmentName: targetEnvName });
      spinner.stop();
      console.log(chalk.green(`Switched to branch "${targetEnvName}"`));
    } catch (err: any) {
      spinner.stop();
      console.error(chalk.red(`Failed to fetch environments: ${err.message}`));
      process.exit(1);
    }
  }

  if (!targetEnvId) {
    console.error(chalk.red("Error: No active environment set."));
    console.log(chalk.dim("Please specify an environment branch to pull (e.g. enc pull development)"));
    process.exit(1);
  }

  const pullSpinner = ora(`Pulling secrets for environment "${targetEnvName || targetEnvId}"...`).start();

  try {
    const { data } = await api.get(`/environments/${targetEnvId}/secrets`);

    writeState({ lastPulledAt: data.pulledAt });

    // Format secrets into .env format
    let envContent = "";
    for (const secret of data.secrets) {
      envContent += `${secret.key}=${secret.value}\n`;
    }

    const envPath = path.join(process.cwd(), ".env");
    fs.writeFileSync(envPath, envContent, "utf8");

    pullSpinner.stop();
    console.log(chalk.green(`Successfully pulled ${data.secrets.length} secrets and wrote to .env`));
  } catch (err: any) {
    pullSpinner.stop();
    console.error(chalk.red(`Failed to pull secrets: ${err.response?.data?.error || err.message}`));
    process.exit(1);
  }
}
