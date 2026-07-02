# Enclave CLI

Secure Secrets Management Platform for Teams.

## Installation

```bash
npm install -g @enclave/cli
```

## Usage

### Injecting Secrets
To inject secrets into your application process in-memory:
```bash
enclave run -- npm run dev
```

### Reverting Secrets
To revert a specific secret key to an older version:
```bash
enclave revert --key DATABASE_URL --ver 2
```
