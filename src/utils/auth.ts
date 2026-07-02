import path from "path";
import os from "os";
import fs from "fs";

const KEYCHAIN_SERVICE = "enclave-secrets-manager";
const KEYCHAIN_ACCOUNT = "auth-token";

const ENCLAVE_DIR = path.join(os.homedir(), ".enclave");
const AUTH_FILE = path.join(ENCLAVE_DIR, "auth.json");

// Helper to save token to a file with owner-only (0600) permissions
function saveTokenToFile(token: string) {
  if (!fs.existsSync(ENCLAVE_DIR)) {
    fs.mkdirSync(ENCLAVE_DIR, { recursive: true });
  }
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ token }), { mode: 0o600 });
}

// Helper to load token from file
function getTokenFromFile(): string | null {
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

// Helper to delete token file
function deleteTokenFile() {
  if (fs.existsSync(AUTH_FILE)) {
    fs.unlinkSync(AUTH_FILE);
  }
}

/**
 * Saves the authentication token.
 * Attempts to write to OS Keychain (Keytar) first, falls back to a secure file.
 */
export async function saveToken(token: string): Promise<void> {
  try {
    const keytar = (await import("keytar")).default;
    await keytar.setPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, token);
  } catch (error) {
    saveTokenToFile(token);
  }
}

/**
 * Retrieves the authentication token.
 * Checks OS Keychain first, falls back to the secure file.
 */
export async function getToken(): Promise<string | null> {
  try {
    const keytar = (await import("keytar")).default;
    const token = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
    if (token) return token;
    return getTokenFromFile();
  } catch (error) {
    return getTokenFromFile();
  }
}

/**
 * Deletes the authentication token (logout).
 */
export async function deleteToken(): Promise<void> {
  try {
    const keytar = (await import("keytar")).default;
    await keytar.deletePassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  } catch (error) {
    // Ignore keychain errors during deletion
  }
  deleteTokenFile();
}

// Authentication token fallback mechanism optimization
