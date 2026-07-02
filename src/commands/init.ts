import chalk from "chalk";
import api from "../utils/api.js";
import { readConfig, writeConfig } from "../utils/config.js";
import { ora } from "../utils/spinner.js";

export async function initCommand(url: string) {
  const existing = readConfig();
  if (existing) {
    console.log(chalk.yellow("This directory is already linked to a project."));
    return;
  }
  let projectId = url;
  console.log(chalk.bold("Linking directory to Enclave project..."));
  const spinner = ora("Verifying link...").start();
  try {
    const { data: project } = await api.get(`/projects/${projectId}`);
    spinner.stop();
    writeConfig({ projectId: project.id });
  } catch (err: any) {
    spinner.stop();
  }
}
