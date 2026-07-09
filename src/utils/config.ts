import fs from "fs";
import path from "path";
import chalk from "chalk";

const ENCLAVE_DIR = ".enc";
const CONFIG_FILE = "config.json";
const STATE_FILE = "state.json";
const LEGACY_CONFIG_FILE = "enclave.json";
const LEGACY_STATE_FILE = ".enclave-state.json";

export interface Environment {
  id: string;
  name: string;
}

export interface EnclaveConfig {
  projectId: string;
  environmentId?: string;
  environmentName?: string; // Metadata for terminal output helper
}

export interface EnclaveState {
  lastPulledAt?: string;
  [key: string]: any;
}

/**
 * Returns the path to the hidden .enclave directory.
 */
function getEnclaveDirPath(): string {
  return path.join(process.cwd(), ENCLAVE_DIR);
}

function migrateLegacyConfig(): EnclaveConfig | null {
  const legacyPath = path.join(process.cwd(), LEGACY_CONFIG_FILE);
  if (!fs.existsSync(legacyPath)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
    if (!data.projectId) {
      return null;
    }
    writeConfig(data);
    fs.unlinkSync(legacyPath);
    return data;
  } catch {
    return null;
  }
}

function migrateLegacyState(): EnclaveState | null {
  const legacyPath = path.join(process.cwd(), LEGACY_STATE_FILE);
  if (!fs.existsSync(legacyPath)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
    writeState(data);
    fs.unlinkSync(legacyPath);
    return data;
  } catch {
    return null;
  }
}

/**
 * Reads the config.json file from the .enclave directory.
 */
export function readConfig(): EnclaveConfig | null {
  const configPath = path.join(getEnclaveDirPath(), CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    return migrateLegacyConfig();
  }
  try {
    const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!data.projectId) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * ponytail: extracted config check to avoid 5x duplication at command start.
 */
export function requireConfig(): EnclaveConfig {
  const config = readConfig();
  if (!config) {
    console.error(chalk.red("Error: Project config not found. Please run 'enc init' first."));
    process.exit(1);
  }
  return config;
}

/**
 * Writes the config.json file to the .enclave directory.
 */
export function writeConfig(config: EnclaveConfig): void {
  const dirPath = getEnclaveDirPath();
  fs.mkdirSync(dirPath, { recursive: true });
  const configPath = path.join(dirPath, CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}

/**
 * Reads the state.json file from the .enclave directory.
 */
export function readState(): EnclaveState | null {
  const statePath = path.join(getEnclaveDirPath(), STATE_FILE);
  if (!fs.existsSync(statePath)) {
    return migrateLegacyState();
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Writes the state.json file to the .enclave directory.
 */
export function writeState(state: EnclaveState): void {
  const dirPath = getEnclaveDirPath();
  fs.mkdirSync(dirPath, { recursive: true });
  const statePath = path.join(dirPath, STATE_FILE);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
}
