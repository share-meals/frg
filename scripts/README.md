# Backup & Restore Scripts

Scripts for backing up and restoring the Directus (d7) instance, including database, uploads, and extensions.

## Prerequisites

- Docker containers `d7_postgres` and `d7_directus` must be running (for backup) or `d7_postgres` must be running (for restore)
- Node.js dependencies installed (`yarn install` from project root)
- AWS credentials configured for S3 uploads (optional — backups are kept locally if S3 fails)

## Scripts

### `backup_full.js` — Full Backup

Creates a single `.tar.gz` archive containing:
- **Database**: `pg_dump` of the full PostgreSQL database (custom format)
- **Uploads**: All files from `/directus/uploads`
- **Extensions**: All extensions (with `node_modules` stripped)

Uploads the archive to S3 at `s3://frg-directus-backups/full-backups/`. If S3 upload fails, the archive is kept locally at `/tmp/`.

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

Restores from a `.tar.gz` archive created by `backup_full.js`. This will:
1. Stop the Directus container
2. Drop and recreate the database
3. Restore the database from the dump
4. Replace uploads and extensions on the host (volume-mounted)
5. Restart Directus

```bash
yarn restore:full <path-to-backup.tar.gz>
```

## Environment Variables

Set in `env/d7.env`:

| Variable | Description |
|---|---|
| `D7_POSTGRES_DB` | PostgreSQL database name |
| `D7_POSTGRES_USER` | PostgreSQL user |
| `BACKUP_BUCKET_NAME` | S3 bucket for storing backups |
| `BACKUP_REGION` | AWS region for the S3 bucket |

## Archive Structure

```
backup.tar.gz
  database.dump     # pg_restore compatible (custom format)
  uploads/          # Directus uploaded files
  extensions/       # Directus extensions (no node_modules)
```
