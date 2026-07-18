# Scripts

## Prerequisites

- Docker containers `d7_postgres` and `d7_directus` must be running (for backup) or `d7_postgres` must be running (for restore)
- Node.js dependencies installed (`yarn install` from project root)
- AWS credentials configured for S3 uploads (optional — backups are kept locally if S3 fails)

## Backup & Restore

### `backup_full.js` — Full Backup

Creates a single `.tar.gz` archive containing the database, uploads, and extensions (with `node_modules` stripped). Uploads the archive to S3 at `s3://frg-directus-backups/full-backups/`. If S3 fails, the archive is kept locally at `/tmp/`.

```bash
yarn backup:full
```

### `backup_d7_postgres.js` — Database-Only Backup

Dumps the PostgreSQL database as a gzipped SQL file and uploads to S3.

```bash
yarn backup:db          # excludes directus_revisions table
yarn backup:db:full     # includes all tables
```

### `restore_full.js` — Full Restore

Restores from a `.tar.gz` archive created by `backup_full.js`:

1. Extracts the archive
2. Stops the Directus container
3. Drops and recreates the database
4. Restores the database dump
5. Replaces uploads and extensions on the host (volume-mounted)
6. Restarts Directus

```bash
yarn restore:full <path-to-backup.tar.gz>
```

### Archive structure

```
backup.tar.gz
  database.dump     # pg_restore compatible (custom format)
  uploads/          # Directus uploaded files
  extensions/       # Directus extensions (no node_modules)
```

## Translation

### `translate_food_pantries.js` — Translate Food Pantries

Translates the `name`, `notes`, and `hours` fields for all food pantries into the languages defined in the `languages` collection.

| Field | Strategy |
|---|---|
| `name` | Plain text translation |
| `notes` | Markdown converted to HTML, translated, then converted back to preserve formatting |
| `hours` | JSON structure preserved; only the optional `notes` within each entry is translated |

The script is idempotent. It skips translations that are already up to date. A translation is considered stale when the food pantry's `lastVerified` is newer than the translation's `lastUpdated`.

```bash
# Local instance (token from d7.env)
node scripts/translate_food_pantries.js --target http://localhost:8055
node scripts/translate_food_pantries.js --target http://localhost:8055 --force

# Remote instance
node scripts/translate_food_pantries.js --target https://example.com --token <static-token>
node scripts/translate_food_pantries.js --target https://example.com --token <static-token> --force
```

| Flag | Description |
|---|---|
| `--target <url>` | **(required)** Directus instance URL |
| `--token <token>` | Static token (defaults to `D7_DIRECTUS_STATIC_TOKEN` from `d7.env`) |
| `--force` | Re-translate all records, ignoring `lastUpdated` |

Requires:
- LibreTranslate running (default: `http://localhost:5000`)
- Languages populated in the `languages` collection

## Schema & Flow Export

### `export_flows.js` — Export Directus Flows

Exports all flows and their operations from Directus to `d7/flows.json` for version tracking.

```bash
yarn export:flows
```

### Schema Snapshot

Exports the full Directus schema (collections, fields, relations) to `d7/snapshot.yaml`:

```bash
yarn export:schema
```

### `import_flows.js` — Import Directus Flows

Imports flows from `d7/flows.json` into a Directus instance. Skips flows that already exist (by ID or name). Creates operations and wires up the resolve/reject chains.

```bash
# Import to local (token from d7.env)
node scripts/import_flows.js --target http://localhost:8055

# Import to remote
node scripts/import_flows.js --target https://example.com --token <static-token>

# Dry run
node scripts/import_flows.js --target https://example.com --token <static-token> --dry-run

# Import specific flow by name
node scripts/import_flows.js --target https://example.com --token <static-token> --flow "Dump Open"
```

| Flag | Description |
|---|---|
| `--target <url>` | Directus instance URL (defaults to `http://localhost:8055`) |
| `--token <token>` | Static token (defaults to `D7_DIRECTUS_STATIC_TOKEN` from `d7.env`) |
| `--flow <name>` | Only import flows matching this name (case-insensitive partial match) |
| `--dry-run` | Preview what would be imported without making changes |

Export and import should be run before and after committing changes to flows or the data model.

## Environment Variables

All set in `env/d7.env`. See `env/d7.env.template` for the full annotated list.

### Postgres

| Variable | Description |
|---|---|
| `D7_POSTGRES_DB` | PostgreSQL database name |
| `D7_POSTGRES_USER` | PostgreSQL user |

### Directus tokens

| Variable | Description |
|---|---|
| `D7_DIRECTUS_STATIC_TOKEN` | Static token for the Directus admin user. Used by the bulk translation script and other tooling. |
| `D7_TRANSLATION_WORKER_TOKEN` | Scoped token for the `translation-worker` service user. Used by the `d7TranslationWorker` runtime — do not use for one-off scripts. |

### Backups (AWS S3)

| Variable | Description |
|---|---|
| `BACKUP_BUCKET_NAME` | S3 bucket for storing backups |
| `BACKUP_REGION` | AWS region for the S3 bucket |
| `D7_DIRECTUS_AWS_S3_KEY_ID` | AWS access key ID for S3 |
| `D7_DIRECTUS_AWS_S3_ACCESS_KEY` | AWS secret access key for S3 |

### Translation

| Variable | Description |
|---|---|
| `LIBRETRANSLATE_URL` | LibreTranslate endpoint (default: `http://localhost:5000`) |
| `LIBRETRANSLATE_API_KEY` | LibreTranslate API key (optional, if auth is required) |

### Message queue (BullMQ)

Used by the `bullmqQueueJob` Directus operation to enqueue translation jobs.

| Variable | Description |
|---|---|
| `MQ_REDIS_HOST` | Hostname of the queue Redis (default: `mq_redis` on the shared docker network) |
| `MQ_REDIS_PORT` | Port (default: `6379`) |
| `MQ_REDIS_PASSWORD` | Password if the queue Redis has `requirepass` set; empty otherwise |

### Publish target (Cloudflare R2)

Used by the `uploadToR2` Directus operation to write scheduled JSON dumps.

| Variable | Description |
|---|---|
| `D7_DIRECTUS_R2_ENDPOINT` | R2 S3 endpoint (`https://<account_id>.r2.cloudflarestorage.com`) |
| `D7_DIRECTUS_R2_ACCESS_KEY_ID` | R2 API token — access key ID |
| `D7_DIRECTUS_R2_SECRET_ACCESS_KEY` | R2 API token — secret |
| `D7_DIRECTUS_R2_BUCKET` | Bucket name (e.g. `cfam-public`) |
| `D7_DIRECTUS_R2_PUBLIC_BASE_URL` | Public URL that CH Map fetches from (e.g. `https://files.cfamhub.org`) |
