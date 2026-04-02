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
yarn translate:foodPantries           # only translate new/stale records
yarn translate:foodPantries --force   # re-translate everything
```

Requires:
- Directus running with a static token configured
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

Both should be run before committing changes to flows or the data model.

## Environment Variables

All set in `env/d7.env`:

| Variable | Description |
|---|---|
| `D7_POSTGRES_DB` | PostgreSQL database name |
| `D7_POSTGRES_USER` | PostgreSQL user |
| `BACKUP_BUCKET_NAME` | S3 bucket for storing backups |
| `BACKUP_REGION` | AWS region for the S3 bucket |
| `D7_DIRECTUS_AWS_S3_KEY_ID` | AWS access key ID for S3 |
| `D7_DIRECTUS_AWS_S3_ACCESS_KEY` | AWS secret access key for S3 |
| `D7_DIRECTUS_STATIC_TOKEN` | Static API token for Directus admin user |
| `LIBRETRANSLATE_URL` | LibreTranslate endpoint (default: `http://localhost:5000`) |
| `LIBRETRANSLATE_API_KEY` | LibreTranslate API key (optional, if auth is required) |
