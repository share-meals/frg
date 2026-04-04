const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Usage: node scripts/import_flows.js [--target <url>] [--token <token>] [--flow <name>] [--dry-run]
// Defaults to local Directus from d7.env

dotenv.config({ path: path.join(__dirname, '../env/d7.env') });

const args = process.argv.slice(2);
function getArg(flag) {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
}

const TARGET_URL = getArg('--target') || 'http://localhost:8055';
const TOKEN = getArg('--token') || process.env.D7_DIRECTUS_STATIC_TOKEN;
const FLOW_FILTER = getArg('--flow'); // optional: only import flows matching this name
const DRY_RUN = args.includes('--dry-run');

if (!TOKEN) {
    console.error('Error: token is required (--token or D7_DIRECTUS_STATIC_TOKEN in d7.env)');
    process.exit(1);
}

function request(url, method, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const mod = u.protocol === 'https:' ? https : http;
        const options = {
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method,
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json',
            },
        };
        const req = mod.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    const flowsPath = path.join(__dirname, '../d7/flows.json');
    const allFlows = JSON.parse(fs.readFileSync(flowsPath, 'utf8'));

    // Get existing flows on target
    const existing = await request(`${TARGET_URL}/flows?fields=id,name&limit=-1`, 'GET');
    const existingIds = new Set(existing.data.data.map(f => f.id));
    const existingNames = new Set(existing.data.data.map(f => f.name));

    // Get existing operations on target
    const existingOps = await request(`${TARGET_URL}/operations?fields=id&limit=-1`, 'GET');
    const existingOpIds = new Set(existingOps.data.data.map(o => o.id));

    const flows = FLOW_FILTER
        ? allFlows.filter(f => f.name.toLowerCase().includes(FLOW_FILTER.toLowerCase()))
        : allFlows;

    if (flows.length === 0) {
        console.log('No flows to import.');
        return;
    }

    for (const flow of flows) {
        const skip = existingIds.has(flow.id);
        const nameExists = existingNames.has(flow.name);

        if (skip) {
            console.log(`SKIP (exists by ID): ${flow.name}`);
            continue;
        }
        if (nameExists) {
            console.log(`SKIP (exists by name): ${flow.name}`);
            continue;
        }

        console.log(`\nImporting flow: ${flow.name} (${flow.trigger})`);

        // Create the flow without linking the first operation yet
        const flowPayload = {
            id: flow.id,
            name: flow.name,
            icon: flow.icon,
            color: flow.color,
            description: flow.description,
            status: flow.status,
            trigger: flow.trigger,
            accountability: flow.accountability,
            options: flow.options,
        };

        if (DRY_RUN) {
            console.log('  [dry-run] Would create flow:', flow.name);
            console.log('  [dry-run] Would create', flow.operations.length, 'operations');
            continue;
        }

        const flowRes = await request(`${TARGET_URL}/flows`, 'POST', flowPayload);
        if (flowRes.status >= 400) {
            console.error('  Error creating flow:', JSON.stringify(flowRes.data));
            continue;
        }
        console.log('  Created flow');

        // Create operations without resolve/reject links first
        const ops = flow.operations || [];
        for (const op of ops) {
            if (existingOpIds.has(op.id)) {
                console.log(`  SKIP operation (exists): ${op.name}`);
                continue;
            }

            const opPayload = {
                id: op.id,
                name: op.name,
                key: op.key,
                type: op.type,
                position_x: op.position_x,
                position_y: op.position_y,
                options: op.options,
                flow: flow.id,
            };

            const opRes = await request(`${TARGET_URL}/operations`, 'POST', opPayload);
            if (opRes.status >= 400) {
                console.error(`  Error creating operation "${op.name}":`, JSON.stringify(opRes.data));
            } else {
                console.log(`  Created operation: ${op.name}`);
            }
        }

        // Now wire up resolve/reject chains
        for (const op of ops) {
            if (existingOpIds.has(op.id)) continue;
            if (op.resolve || op.reject) {
                const patch = {};
                if (op.resolve) patch.resolve = op.resolve;
                if (op.reject) patch.reject = op.reject;

                const patchRes = await request(`${TARGET_URL}/operations/${op.id}`, 'PATCH', patch);
                if (patchRes.status >= 400) {
                    console.error(`  Error linking "${op.name}":`, JSON.stringify(patchRes.data));
                }
            }
        }

        // Link the flow's first operation
        if (flow.operation) {
            const linkRes = await request(`${TARGET_URL}/flows/${flow.id}`, 'PATCH', { operation: flow.operation });
            if (linkRes.status >= 400) {
                console.error('  Error linking first operation:', JSON.stringify(linkRes.data));
            } else {
                console.log('  Linked operation chain');
            }
        }
    }

    console.log('\nDone.');
}

main().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
