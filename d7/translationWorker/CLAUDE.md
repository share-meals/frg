# Translation Worker

BullMQ consumer that translates food pantry fields via LibreTranslate and writes results back to Directus.

## How it works

1. Listens on the `"d7 food pantry translation"` Redis queue (MQ Redis, not d7 cache Redis)
2. Receives jobs with `{pantryId, language, name, notes, hours}`
3. Translates each field via LibreTranslate (`name` as plain text, `notes` as markdown-to-HTML roundtrip, `hours[].notes` as plain text)
4. Creates or updates the translation in Directus's `foodPantries_translations` junction table

## Job producer

Jobs are enqueued by Directus Flow `58003834-ac8d-4159-965a-61ea96cf5ec2` ("Queue Food Pantry Translation on Update"). It fires on `items.update` to `foodPantries` when `name`, `notes`, or `hours` changes, and creates one job per non-English language. The flow is currently **inactive**.

The flow calls the `Queue Job` helper flow (`18e2267d`), which uses the `bullmqQueueJob` Directus extension to push to MQ Redis.

## Build and run

```bash
yarn install && yarn build
yarn start
```

Requires env vars from `.env` (see `env.template`). Connects to MQ Redis (`MQ_HOST`/`MQ_PORT`), Directus (`DIRECTUS_URL`/`DIRECTUS_STATIC_TOKEN`), and LibreTranslate (`LIBRETRANSLATE_URL`).

## Related

- `scripts/translate_food_pantries.js` — batch script that translates all pantries directly (no queue). Disable the Directus flow before running to avoid redundant jobs.
- `docs/d7.md` — full translation workflow docs including language aliasing.
