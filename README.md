# frg

Backend for the City Harvest Food Resource Guide and CH Map. This repo is the source of truth for four docker-compose stacks — Directus (`d7`), the BullMQ queue (`mq`), Keycloak auth (`auth`), and a local LibreTranslate (`i18n`) — plus the worker that translates food-pantry content and the Directus flows that publish it to Cloudflare R2.

## What lives here

```
├── yaml/                     docker-compose files (one per stack)
├── env/                      environment templates (real .env files are gitignored)
├── d7/                       Directus content
│   ├── directus/extensions/    custom operation extensions (uploadToR2, bullmqQueueJob, …)
│   ├── translationWorker/      BullMQ worker: consumes translation jobs, calls LibreTranslate,
│   │                           writes back to Directus, pings healthchecks
│   ├── flows.json              snapshot of Directus flows (see docs/d7.md)
│   └── snapshot.yaml           schema snapshot
├── scripts/                  Node CLI utilities — backups, bulk translation, flow import/export
└── docs/                     Reference docs (below)
```

## The pipelines at a glance

Content flows through two connected paths — a **translate** loop and a **publish** loop:

![translation workflow diagram](docs/translation_workflow.drawio)
(Open in [app.diagrams.net](https://app.diagrams.net) or the VS Code Draw.io extension.)

**Translate.** An editor updates a food pantry in Directus → `Queue Food Pantry Translation ▸ On Update` fires → BullMQ enqueues one job per non-English language → `d7TranslationWorker` picks up each job → calls LibreTranslate → upserts into `foodPantries_translations`.

**Publish.** A scheduled Directus flow (`Dump Food Pantries All Languages ▸ Scheduled`) fans out per language → each run reads all open pantries, merges the translated fields, and uploads a JSON dump to Cloudflare R2 → CH Map fetches `https://files.cfamhub.org/feeds/pantries.open.<lang>.json`.

## Quick start

Bring up the local stacks (each in its own detached compose project):

```bash
docker network create frg-shared   # one-time; both d7 and mq attach to this
yarn start:d7:d                    # Directus + Postgres + cache Redis + healthcheck
yarn start:mq:d                    # BullMQ Redis + Bull Board + healthcheck
yarn start:i18n                    # LibreTranslate (optional locally — you can point at a remote instance)
```

Then in another terminal, run the worker:

```bash
cd d7/translationWorker
yarn install && yarn build && yarn start
```

Directus admin lives at `http://localhost:8055`. Bull Board at `http://localhost:3000` (basic auth from `env/mq.env`).

## Docs

| Doc | Covers |
|---|---|
| [docs/d7.md](docs/d7.md) | Directus specifics — backups, translations, all eight flows, R2 output layout |
| [docs/auth.md](docs/auth.md) | Keycloak setup (Google IDP, no self-signup) |
| [scripts/README.md](scripts/README.md) | CLI tooling: backups, bulk translation, flow import/export, and the full env-var reference |
| [d7/translationWorker/README.md](d7/translationWorker/README.md) | The BullMQ worker itself |
| [docs/translation_workflow.drawio](docs/translation_workflow.drawio) | End-to-end architecture diagram |

## Related repos

- [share-meals/city-harvest-resource-map](https://github.com/share-meals/city-harvest-resource-map) — CH Map (React frontend) that consumes the R2 feeds.
