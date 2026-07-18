# d7 Translation Worker

BullMQ worker that processes real-time food pantry translation jobs. Listens on the `d7 food pantry translation` queue, translates fields via LibreTranslate, and writes results back to Directus.

## Setup

```bash
cp env.template .env
# fill in DIRECTUS_STATIC_TOKEN and other values
yarn install
yarn build
```

## Running

```bash
yarn start
```

## How it works

1. A food pantry is updated in Directus (name, notes, or hours)
2. The `Queue Food Pantry Translation ▸ On Update` flow enqueues one job per non-English language
3. This worker picks up each job and:
   - Skips jobs whose target language is not supported by LibreTranslate (currently `ht`)
   - Translates `name` as plain text
   - Translates `notes` as markdown (via HTML round-trip)
   - Translates `hours` JSON (only the optional `notes` field in each entry)
4. Writes the translation back to `foodPantries_translations` via the Directus API
5. Pings `HEALTHCHECK_URL` on each successful completion (if set)

## Environment Variables

| Variable | Description |
|---|---|
| `DIRECTUS_URL` | Directus instance URL |
| `DIRECTUS_STATIC_TOKEN` | Static API token for a Directus user with write access to `foodPantries_translations` |
| `LIBRETRANSLATE_URL` | LibreTranslate endpoint |
| `LIBRETRANSLATE_API_KEY` | LibreTranslate API key (optional) |
| `MQ_HOST` | Redis (BullMQ) host |
| `MQ_PORT` | Redis (BullMQ) port |
| `HEALTHCHECK_URL` | Optional healthchecks.io ping URL — hit on each successful job |

## Monitoring

View job status in the Bull Board UI at `http://localhost:3000`.
