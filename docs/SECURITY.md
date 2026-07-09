# Enclave CLI Security Model

The Enclave Command Line Interface (CLI) is designed to manage and inject secrets securely without persisting plaintext credentials to the developer's storage disk.

## Security Controls

### 1. Zero-Disk Plaintext Storage
* **OS Keychain Integration:** All Personal Access Tokens (PATs) are saved directly inside the operating system's native keychain:
  - **macOS:** Apple Keychain Service via `security`.
  - **Windows:** Credential Manager via `cmdkey` and a native PowerShell Credential Cache wrapper.
  - **Linux:** Libsecret keyring via `secret-tool`.
* **Owner-Only File Fallback:** If the OS keychain tools are not found, the token is written to `~/.enclave/auth.json` with strict `0600` permissions (readable/writeable *only* by the current user).

### 2. Direct-to-Memory Injection (`enc run`)
* **Environment Injection:** The CLI retrieves decrypted environment parameters from the API over TLS and injects them directly into the environment memory of the spawned child process (`child_process.spawn`).
* Plaintext secret values never touch your hard drive (avoiding exposure in logs, temporary files, or swap memory).

### 3. Transit Security
* All API calls are forced over TLS/HTTPS. Plaintext HTTP traffic is rejected by the server.
