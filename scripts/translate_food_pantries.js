const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const showdown = require('showdown');
const TurndownService = require('turndown');

dotenv.config({ path: path.join(__dirname, '../env/d7.env') });

const DIRECTUS_URL = 'http://localhost:8055';
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'http://localhost:5000';
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';
const BATCH_SIZE = 50;
const FORCE = process.argv.includes('--force');

const mdToHtml = new showdown.Converter();
const htmlToMd = new TurndownService({ bulletListMarker: '-' });

function fetch(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, {
            method: opts.method || 'GET',
            headers: opts.headers || {}
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response from ${url}: ${data.slice(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        if (opts.body) req.write(opts.body);
        req.end();
    });
}

const STATIC_TOKEN = process.env.D7_DIRECTUS_STATIC_TOKEN;
if (!STATIC_TOKEN) {
    console.error('Error: D7_DIRECTUS_STATIC_TOKEN is required in d7.env');
    process.exit(1);
}

async function translate(text, targetLang) {
    const body = { q: text, source: 'en', target: targetLang };
    if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;
    const result = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return result.translatedText;
}

async function translateMarkdown(md, targetLang) {
    const html = mdToHtml.makeHtml(md);
    const body = { q: html, source: 'en', target: targetLang, format: 'html' };
    if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;
    const result = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return htmlToMd.turndown(result.translatedText);
}

async function translateHours(hours, targetLang) {
    if (!hours) return null;
    const translated = [];
    for (const entry of hours) {
        const copy = { days: entry.days, timeStart: entry.timeStart, timeEnd: entry.timeEnd };
        if (entry.notes) {
            copy.notes = await translate(entry.notes, targetLang);
        }
        translated.push(copy);
    }
    return translated;
}

async function getLanguages(headers) {
    const result = await fetch(`${DIRECTUS_URL}/items/languages?fields=code`, { headers });
    return result.data.map(l => l.code);
}

async function main() {
    console.log(`Starting food pantries translation...${FORCE ? ' (FORCE mode — re-translating all)' : ''}\n`);

    const headers = { 'Authorization': `Bearer ${STATIC_TOKEN}`, 'Content-Type': 'application/json' };

    // Get target languages
    const langs = await getLanguages(headers);
    console.log(`Target languages: ${langs.join(', ')}`);

    // Count total pantries
    const countResult = await fetch(`${DIRECTUS_URL}/items/foodPantries?aggregate[count]=id`, { headers });
    const total = countResult.data[0].count.id;
    console.log(`Total food pantries: ${total}\n`);

    let offset = 0;
    let processed = 0;
    let translated = 0;
    let skipped = 0;
    let errors = 0;

    while (offset < total) {

        const batch = await fetch(
            `${DIRECTUS_URL}/items/foodPantries?fields=id,name,notes,hours,lastVerified,translations.id,translations.languages_code,translations.lastUpdated&limit=${BATCH_SIZE}&offset=${offset}&sort=id`,
            { headers }
        );

        if (!batch.data || batch.data.length === 0) break;

        for (const pantry of batch.data) {
            processed++;

            try {
                for (const lang of langs) {
                    const existing = (pantry.translations || []).find(t => t.languages_code === lang);

                    if (existing && !FORCE) {
                        // Skip if translation exists and is newer than lastVerified
                        const lastVerified = pantry.lastVerified ? new Date(pantry.lastVerified) : null;
                        const lastUpdated = existing.lastUpdated ? new Date(existing.lastUpdated) : null;

                        if (lastUpdated && (!lastVerified || lastVerified <= lastUpdated)) {
                            skipped++;
                            continue;
                        }
                        // Otherwise, re-translate (source data changed since last translation)
                    }

            
                    // Translate fields
                    const translatedName = pantry.name ? await translate(pantry.name, lang) : null;
                    const translatedNotes = pantry.notes ? await translateMarkdown(pantry.notes, lang) : null;
                    const translatedHours = await translateHours(pantry.hours, lang);

                    const payload = {
                        languages_code: lang,
                        name: translatedName,
                        notes: translatedNotes,
                        hours: translatedHours
                    };

                    if (existing) {
                        // Update existing translation
                        payload.id = existing.id;
                        await fetch(`${DIRECTUS_URL}/items/foodPantries/${pantry.id}`, {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({ translations: { update: [payload] } })
                        });
                    } else {
                        // Create new translation
                        await fetch(`${DIRECTUS_URL}/items/foodPantries/${pantry.id}`, {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({ translations: { create: [payload] } })
                        });
                    }

                    translated++;
                }

                if (processed % 10 === 0 || processed === parseInt(total)) {
                    console.log(`[${processed}/${total}] translated: ${translated}, skipped: ${skipped}, errors: ${errors}`);
                }
            } catch (err) {
                errors++;
                console.error(`  Error on "${pantry.name}" (${pantry.id}): ${err.message}`);
            }
        }

        offset += BATCH_SIZE;
    }

    console.log(`\nDone! Processed: ${processed}, Translated: ${translated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
