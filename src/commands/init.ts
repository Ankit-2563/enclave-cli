import chalk from "chalk";
import api from "../utils/api.js";
import { readConfig, writeConfig } from "../utils/config.js";
import ora from "ora";

/**
 * Links the current directory to an Enclave project.
 * Example: `enc init enclave://<project-id>`
 */
export async function initCommand(url: string) {
  const existing = readConfig();
  if (existing) {
    console.log(
      chalk.yellow(
        `This directory is already linked to a project.`
      )
    );
    console.log(chalk.dim("Delete the .enc directory if you want to link it to a different project."));
    return;
  }

  if (!url) {
    console.log(chalk.red("Error: Please provide a valid project URL."));
    console.log(chalk.dim("Example: enc init https://enclave.ankitbhavarthe.xyz/projects/<project-id>"));
    process.exit(1);
  }

  let projectId = "";
  try {
    const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[parts.length - 2] === "projects") {
      projectId = parts[parts.length - 1];
    } else {
      // Fallback if they just pasted a generic path or ID
      projectId = parts[parts.length - 1];
    }
  } catch (err) {
    // If URL parsing completely fails, assume they might have just pasted the raw ID
    projectId = url;
  }

  if (!projectId) {
    console.log(chalk.red("Invalid URL format. Missing project ID."));
    process.exit(1);
  }

  console.log(chalk.bold("Linking directory to Enclave project..."));

  const spinner = ora("Verifying link...").start();
  try {
    const { data: project } = await api.get(`/projects/${projectId}`);
    spinner.stop();

    writeConfig({
      projectId: project.id,
    });

    console.log(
      chalk.green(
        `\nLinked to project "${project.name}". Config saved in .enc/`
      )
    );
    console.log(chalk.dim("You can now checkout an environment by running: enc pull <environment-name>"));
  } catch (err: any) {
    spinner.stop();
    console.error(
      chalk.red(`\nFailed to link project: ${err.response?.data?.error || err.message}`)
    );
  }
}
