import axios from 'axios';
import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import Showdown from 'showdown';
import TurndownService from 'turndown';
import * as dotenv from 'dotenv';
dotenv.config();

const DIRECTUS_URL = process.env.DIRECTUS_URL!;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN!;
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL!;
const LIBRETRANSLATE_API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

const mdToHtml = new Showdown.Converter();
const htmlToMd = new TurndownService({ bulletListMarker: '-' });

interface HoursEntry {
    days: string[];
    timeStart: string;
    timeEnd: string;
    notes?: string;
}

interface JobPayload {
    pantryId: string;
    language: string;
    name: string | null;
    notes: string | null;
    hours: HoursEntry[] | null;
}

function getNow(): string {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
    }).format(new Date());
}

async function translate(text: string, targetLang: string): Promise<string> {
    const body: Record<string, string> = {
        q: text,
        source: 'en',
        target: targetLang,
    };
    if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;

    const res = await axios.post(`${LIBRETRANSLATE_URL}/translate`, body);
    return res.data.translatedText;
}

async function translateMarkdown(md: string, targetLang: string): Promise<string> {
    const html = mdToHtml.makeHtml(md);
    const body: Record<string, string> = {
        q: html,
        source: 'en',
        target: targetLang,
        format: 'html',
    };
    if (LIBRETRANSLATE_API_KEY) body.api_key = LIBRETRANSLATE_API_KEY;

    const res = await axios.post(`${LIBRETRANSLATE_URL}/translate`, body);
    return htmlToMd.turndown(res.data.translatedText);
}

async function translateHours(
    hours: HoursEntry[],
    targetLang: string
): Promise<HoursEntry[]> {
    const translated: HoursEntry[] = [];
    for (const entry of hours) {
        const copy: HoursEntry = {
            days: entry.days,
            timeStart: entry.timeStart,
            timeEnd: entry.timeEnd,
        };
        if (entry.notes) {
            copy.notes = await translate(entry.notes, targetLang);
        }
        translated.push(copy);
    }
    return translated;
}

async function processJob(job: Job<JobPayload>): Promise<void> {
    const { pantryId, language, name, notes, hours } = job.data;

    job.log(`${getNow()} - translating pantry ${pantryId} to ${language}`);

    // Translate fields
    const translatedName = name ? await translate(name, language) : null;
    job.updateProgress(25);
    job.log(`${getNow()} - translated name`);

    const translatedNotes = notes ? await translateMarkdown(notes, language) : null;
    job.updateProgress(50);
    job.log(`${getNow()} - translated notes`);

    const translatedHours = hours ? await translateHours(hours, language) : null;
    job.updateProgress(75);
    job.log(`${getNow()} - translated hours`);

    // Check if translation already exists
    const headers = {
        Authorization: `Bearer ${DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json',
    };

    const existing = await axios.get(
        `${DIRECTUS_URL}/items/foodPantries/${pantryId}?fields=translations.id,translations.languages_code`,
        { headers }
    );

    const existingTranslation = existing.data.data.translations?.find(
        (t: { languages_code: string; id: number }) => t.languages_code === language
    );

    const payload: Record<string, unknown> = {
        languages_code: language,
        name: translatedName,
        notes: translatedNotes,
        hours: translatedHours,
    };

    if (existingTranslation) {
        payload.id = existingTranslation.id;
        await axios.patch(
            `${DIRECTUS_URL}/items/foodPantries/${pantryId}`,
            { translations: { update: [payload] } },
            { headers }
        );
    } else {
        await axios.patch(
            `${DIRECTUS_URL}/items/foodPantries/${pantryId}`,
            { translations: { create: [payload] } },
            { headers }
        );
    }

    job.updateProgress(100);
    job.log(`${getNow()} - saved translation to Directus`);
}

const connection = new Redis({
    host: process.env.MQ_HOST,
    port: Number(process.env.MQ_PORT),
    maxRetriesPerRequest: null,
});

const worker = new Worker<JobPayload>(
    'd7 food pantry translation',
    processJob,
    { connection }
);

worker.on('completed', (job) => {
    console.log(`[${getNow()}] Completed: ${job.data.pantryId} → ${job.data.language}`);
});

worker.on('failed', (job, err) => {
    console.error(`[${getNow()}] Failed: ${job?.data.pantryId} → ${job?.data.language}: ${err.message}`);
});

console.log('d7 Translation Worker started. Listening on queue: "d7 food pantry translation"');
