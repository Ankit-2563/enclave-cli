import path from "path";
import os from "os";
import fs from "fs";

const ENCLAVE_DIR = path.join(os.homedir(), ".enclave");
const AUTH_FILE = path.join(ENCLAVE_DIR, "auth.json");

/**
 * Saves the authentication token to a secure file with owner-only permissions (0600).
 */
export async function saveToken(token: string): Promise<void> {
  if (!fs.existsSync(ENCLAVE_DIR)) {
    fs.mkdirSync(ENCLAVE_DIR, { recursive: true });
  }
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ token }), { mode: 0o600 });
}

/**
 * Retrieves the authentication token from the secure file.
 */
export async function getToken(): Promise<string | null> {
  if (!fs.existsSync(AUTH_FILE)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    return data.token || null;
  } catch (e) {
    return null;
  }
}

/**
 * Deletes the authentication token (logout).
 */
export async function deleteToken(): Promise<void> {
  if (fs.existsSync(AUTH_FILE)) {
    fs.unlinkSync(AUTH_FILE);
  }
}
