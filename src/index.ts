#!/usr/bin/env node

import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { initCommand } from "./commands/init.js";
import { pullCommand } from "./commands/pull.js";
import { pushCommand } from "./commands/push.js";
import { revertCommand } from "./commands/revert.js";
import { runCommand } from "./commands/run.js";

const program = new Command();

program
  .name("enclave")
  .description("Enclave CLI - Secure Secrets Management Platform for Teams")
  .version("0.1.4");

program
  .command("login")
  .description("Authenticate the CLI with Enclave via OAuth or direct Token")
  .option("-p, --provider <provider>", "OAuth Provider ('google' or 'github')", "google")
  .option("-t, --token <token>", "Direct Personal Access Token (PAT) authentication")
  .action((options) => loginCommand(options));

program
  .command("init")
  .description("Link current directory to an Enclave project (one-time setup)")
  .argument("<url>", "Enclave URL to link (e.g. enclave://<project-id>)")
  .action((url) => initCommand(url));

program
  .command("pull")
  .description("Fetch current secrets from the server and write to a local .env file")
  .argument("[environment]", "The environment branch to pull (e.g. development)")
  .option("-d, --development", "Pull from development branch")
  .option("-s, --staging", "Pull from staging branch")
  .option("-p, --production", "Pull from production branch")
  .action((env, options) => pullCommand(env, options));

program
  .command("push")
  .description("Read local .env file, perform diff check, and push to the server")
  .action(() => pushCommand());

program
  .command("revert")
  .description("Rollback secret values to a specific version or point in time")
  .option("-k, --key <key>", "The secret key to revert")
  .option("-v, --ver <version>", "Specific version number to restore (requires key)")
  .option("-b, --before <timestamp>", "Timestamp for environment-wide rollback")
  .action((options) => revertCommand(options));

program
  .command("run")
  .description("Fetch secrets into memory and inject them as environment variables into a command")
  .argument("<command...>", "Command to execute with secrets injected")
  .action((args) => runCommand(args));

program.parse(process.argv);
