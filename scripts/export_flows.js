const http = require('http');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../env/d7.env') });

const DIRECTUS_URL = 'http://localhost:8055';
const STATIC_TOKEN = process.env.D7_DIRECTUS_STATIC_TOKEN;

if (!STATIC_TOKEN) {
    console.error('Error: D7_DIRECTUS_STATIC_TOKEN is required in d7.env');
    process.exit(1);
}

function fetch(url, headers) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { headers }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    const headers = { 'Authorization': `Bearer ${STATIC_TOKEN}` };

    const result = await fetch(`${DIRECTUS_URL}/flows?fields=*,operations.*&limit=-1`, headers);

    const outPath = path.join(__dirname, '../d7/flows.json');
    fs.writeFileSync(outPath, JSON.stringify(result.data, null, 2) + '\n');
    console.log(`Exported ${result.data.length} flows to ${outPath}`);
}

main().catch(err => {
    console.error('Export failed:', err);
    process.exit(1);
});
