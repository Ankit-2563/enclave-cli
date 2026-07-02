import chalk from "chalk";
import api from "../utils/api.js";
import { readConfig } from "../utils/config.js";
import { ora, stopFailure, stopSuccess } from "../utils/spinner.js";

/**
 * Handles reverting a single key or the entire environment.
 */
export async function revertCommand(options: { key?: string; ver?: string; before?: string }) {
  const config = readConfig();
  if (!config) {
    console.error(chalk.red("Error: Project config not found. Please run 'enclave init' first."));
    process.exit(1);
  }

  const key = options.key;
  const before = options.before;

  let version: number | undefined = undefined;
  if (options.ver !== undefined) {
    version = parseInt(options.ver);
    if (isNaN(version)) {
      console.error(chalk.red("Error: Version must be a valid integer."));
      process.exit(1);
    }
  }

  if (!key && !before) {
    console.error(
      chalk.red("Error: You must specify either '--key <key> --ver <version>' or '--before <timestamp>'.")
    );
    process.exit(1);
  }

  if (key && version === undefined) {
    console.error(chalk.red("Error: You must specify '--ver <version>' when reverting a single key."));
    process.exit(1);
  }

  const spinner = ora("Reverting secrets on Enclave...").start();

  try {
    const { data } = await api.post(`/environments/${config.environmentId}/secrets/revert`, {
      key,
      version,
      timestamp: before,
    });

    stopSuccess(spinner, "Secrets reverted successfully!");

    if (data.type === "single") {
      console.log(chalk.bold("\nRevert Details:"));
      console.log(`  Key: ${chalk.cyan(data.key)}`);
      console.log(`  Reverted to Version: ${chalk.green(data.revertedToVersion)}`);
      console.log(chalk.dim("  Note: A new version has been generated to make this revert undoable."));
    } else if (data.type === "environment") {
      console.log(chalk.bold(`\nEnvironment Reverted to ${data.timestamp}:`));
      if (data.changes.length === 0) {
        console.log(chalk.yellow("  No changes made (secrets were already at the target timestamp state)."));
      } else {
        data.changes.forEach((change: any) => {
          if (change.toVersion === "deleted") {
            console.log(`  ${chalk.red(`- Removed:`)} ${change.key} (was version ${change.fromVersion})`);
          } else {
            console.log(
              `  ${chalk.green(`~ Reverted:`)} ${change.key} (version ${change.fromVersion} -> version ${change.toVersion})`
            );
          }
        });
        console.log(chalk.dim("\n  Note: New versions were generated for all modified secrets."));
      }
    }
  } catch (err: any) {
    stopFailure(spinner, `Failed to revert secrets: ${err.response?.data?.error || err.message}`);
    process.exit(1);
  }
}
