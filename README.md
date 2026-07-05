# Enclave CLI

**Secure secrets management for developer teams.** Push, pull, and inject environment variables with Git-like commands — no plaintext `.env` files.

[![npm version](https://badge.fury.io/js/%40ankitbhavarthe%2Fenclave-cli.svg)](https://www.npmjs.com/package/@ankitbhavarthe/enclave-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

## Installation

```bash
npm install -g @ankitbhavarthe/enclave-cli
```

Verify installation:

```bash
enc --version
```

## Quick Start

### 1. Authenticate

```bash
# Login via Google (default)
enc login

# Login via GitHub
enc login --provider github

# Login with a Personal Access Token (PAT) from the dashboard
enc login --token env_pat_xxxxx
```

### 2. Link your project

Copy the project URL from the Enclave dashboard and run:

```bash
enc init enclave://<your-project-id>
```

This creates a `.enc/config.json` in your current directory (add `.enc/` to `.gitignore`).

### 3. Push your existing `.env`

```bash
enc push
```

### 4. Pull secrets from the server

```bash
# Pull the default environment
enc pull

# Pull a specific environment
enc pull production
enc pull --staging
enc pull --development
```

### 5. Inject secrets into a process (recommended)

Zero plaintext exposure — secrets are fetched and injected directly into memory:

```bash
enc run -- npm run dev
enc run -- python manage.py runserver
enc run -- node server.js
```

### 6. Revert secrets

```bash
# Revert a single key to a specific version
enc revert --key DATABASE_URL --ver 3

# Roll back the entire environment to a point in time
enc revert --before "2h ago"
```

## Commands Reference

| Command | Description |
|---|---|
| `enc login` | Authenticate via Google/GitHub OAuth or PAT |
| `enc init <url>` | Link current directory to an Enclave project |
| `enc pull [environment]` | Download secrets to a local `.env` file |
| `enc push` | Push local `.env` changes to the server |
| `enc run -- <cmd>` | Inject secrets in-memory and run a command |
| `enc revert` | Revert secrets to a previous version or point in time |

## Configuration

The CLI reads the following environment variables:

| Variable | Default | Description |
|---|---|---|
| `ENCLAVE_API_URL` | `https://enclaveapi.ankitbhavarthe.xyz/api` | Override the API endpoint (for self-hosted instances) |
| `ENCLAVE_SERVER_URL` | `https://enclaveapi.ankitbhavarthe.xyz` | Override the server URL (for OAuth login flow) |

### Self-Hosted Usage

If you run your own Enclave server, set both variables:

```bash
export ENCLAVE_API_URL=https://your-server.com/api
export ENCLAVE_SERVER_URL=https://your-server.com
enc login
```

## Token Storage

Tokens are stored securely using the OS keychain (via [keytar](https://github.com/atom/node-keytar)):
- **macOS** — Keychain
- **Linux** — libsecret / kwallet
- **Windows** — Credential Vault

Falls back to a file at `~/.enclave/auth.json` (permissions `0600`) if the keychain is unavailable (e.g., CI environments).

## .gitignore Recommendations

Add these to your project's `.gitignore`:

```
.env
.env.*
.enc/
```

## Requirements

- Node.js >= 18.0.0
- An Enclave account at https://enclave.ankitbhavarthe.xyz

## Links

- **Website:** https://enclave.ankitbhavarthe.xyz
- **Docs:** https://enclave.ankitbhavarthe.xyz/docs
- **Issues:** https://github.com/Ankit-2563/enclave-cli/issues

## License

MIT
