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
2. The "Queue Food Pantry Translation on Update" flow enqueues one job per language
3. This worker picks up each job and:
   - Translates `name` as plain text
   - Translates `notes` as markdown (via HTML round-trip)
   - Translates `hours` JSON (only the optional `notes` field in each entry)
4. Writes the translation back to `foodPantries_translations` via the Directus API

## Environment Variables

| Variable | Description |
|---|---|
| `DIRECTUS_URL` | Directus instance URL |
| `DIRECTUS_STATIC_TOKEN` | Static API token for Directus admin user |
| `LIBRETRANSLATE_URL` | LibreTranslate endpoint |
| `LIBRETRANSLATE_API_KEY` | LibreTranslate API key (optional) |
| `MQ_HOST` | Redis host |
| `MQ_PORT` | Redis port |

## Monitoring

View job status in the Bull Board UI at `http://localhost:3000`.
