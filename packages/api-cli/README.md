# @web-loom/api-cli

CLI for scaffolding and generating Web Loom API projects.

## Current Position

The CLI exists and is usable for scaffolding/templates and generation commands, but the current agency standard is still centered on the Cloudflare-first runtime path described in the root README.

## Install

```bash
npm install -D @web-loom/api-cli
```

## Commands

```bash
webloom init
webloom generate
webloom migrate
webloom dev
webloom seed
```

## Standard Template Direction

The templates are being aligned to:

- Cloudflare Workers as the default deployment target
- Neon Postgres as the default database
- `/api` as the application route base
- OpenAPI enabled by default

## Notes

- `webloom dev` is not the primary standard path for Cloudflare projects yet; prefer the runtime and deployment setup described in the main repo docs.
- Use the generated templates as a starting point, then align them with the current standard defaults from the root README if needed.
