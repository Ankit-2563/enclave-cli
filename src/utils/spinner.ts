import chalk from "chalk";
import ora, { Ora } from "ora";

/** Stop spinner without a checkmark/cross symbol — plain text only. */
export function stopSuccess(spinner: Ora, message: string): void {
  spinner.stop();
  console.log(chalk.green(message));
}

export function stopFailure(spinner: Ora, message: string): void {
  spinner.stop();
  console.error(chalk.red(message));
}

export { ora };
