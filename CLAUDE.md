# FRG (Food Resource Guide)

Infrastructure project for Share Meals / Center for Food as Medicine. Manages Directus CMS, translation pipelines, and data exports via Docker Compose.

## Project layout

- `yaml/` — Docker Compose files (d7, mq, auth, i18n)
- `env/` — Environment files (gitignored `*.env`, tracked `*.env.template`)
- `d7/` — Directus config, extensions, translation worker, flows, schema snapshot
- `scripts/` — CLI tools (backup, restore, translate, import/export)
- `docs/` — Architecture and operational docs

## Conventions

- **Docker Compose only.** Do not create or modify Dockerfiles. Use mounted volumes for extensions and customizations.
- **Project names.** All compose commands use `-p frg-<stack>` (e.g. `frg-d7`, `frg-mq`, `frg-auth`, `frg-i18n`).
- **Env files.** Each stack has `env/<stack>.env` (secrets, gitignored) and `env/<stack>.env.template` (tracked). Always update the template when adding new env vars.
- **Convenience scripts.** `yarn start:<stack>` / `yarn start:<stack>:d` for foreground/detached. See `package.json`.
- **Shipping changes.** "Ship" means: create branch, commit, push, open PR, merge, return to main, delete local branch, prune remotes.

## Service groups

| Stack | Compose file | Services |
|---|---|---|
| d7 | `yaml/d7.yaml` | Directus, Postgres, Redis (cache), healthcheck |
| mq | `yaml/mq.yaml` | Redis (queues), Bull Board, healthcheck |
| auth | `yaml/auth.yaml` | Keycloak, Postgres |
| i18n | `yaml/i18n.yaml` | LibreTranslate |

d7 Redis (`d7_redis`) is for Directus caching. MQ Redis (`mq_redis`) is for BullMQ job queues. They are separate installations.

## Flows and schema

Directus flows and schema are stored in the database. Export before committing changes:

```bash
yarn export:all      # schema + flows
yarn export:flows    # flows only -> d7/flows.json
yarn export:schema   # schema only -> d7/snapshot.yaml
```
