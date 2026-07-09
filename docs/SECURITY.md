# Enclave CLI Security Model

The Enclave Command Line Interface (CLI) is designed to manage and inject secrets securely without persisting plaintext credentials to the developer's storage disk.

## Security Controls

### 1. OS Keychain & Plaintext Fallback Storage
* **OS Keychain Integration:** All Personal Access Tokens (PATs) are saved directly inside the operating system's native keychain:
  - **macOS:** Apple Keychain Service via `security`.
  - **Windows:** Credential Manager via `cmdkey` and a native PowerShell Credential Cache wrapper.
  - **Linux:** Libsecret keyring via `secret-tool`.
* **Plaintext Fallback Storage:** If the OS keychain tools are not found (e.g. in headless environments, Docker containers, remote servers), the token is written in plaintext to `~/.enclave/auth.json` with strict `0600` permissions (readable/writeable *only* by the current user). A warning is printed to `stderr` indicating that fallback storage is active.
* **Strict Mode & Env Token Bypass:** 
  - To prevent writing to disk completely, you can set the `ENCLAVE_API_TOKEN` environment variable. The CLI will prioritize this token, bypassing disk storage altogether.
  - If you want to strictly prevent any fallback to disk (e.g., in secure CI pipelines), you can set `ENCLAVE_STRICT=1`. When strict mode is enabled, the CLI will hard-fail if keychain services are unavailable, refusing to write plaintext tokens to disk.

### 2. Direct-to-Memory Injection (`enc run`)
* **Environment Injection:** The CLI retrieves decrypted environment parameters from the API over TLS and injects them directly into the environment memory of the spawned child process (`child_process.spawn`).
* Plaintext secret values never touch your hard drive (avoiding exposure in logs, temporary files, or swap memory).

### 3. Transit Security
* All API calls are forced over TLS/HTTPS. Plaintext HTTP traffic is rejected by the server.
