const { exec } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../env/d7.env') });

const {
    D7_POSTGRES_DB: dbName,
    D7_POSTGRES_USER: dbUser
} = process.env;

for (const [name, value] of Object.entries({ D7_POSTGRES_DB: dbName, D7_POSTGRES_USER: dbUser })) {
    if (!value) {
        console.error(`Error: ${name} is required in d7.env`);
        process.exit(1);
    }
}

const archivePath = process.argv[2];
if (!archivePath) {
    console.error('Usage: node scripts/restore_full.js <path-to-backup.tar.gz>');
    process.exit(1);
}

if (!fs.existsSync(archivePath)) {
    console.error(`File not found: ${archivePath}`);
    process.exit(1);
}

const tmpDir = `/tmp/directus-restore-${Date.now()}`;

// Single-quote a value for safe interpolation into a shell command.
function shq(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

// Double-quote a Postgres identifier (database name, role, ...).
function sqlIdent(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}

function execPromise(command, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`> ${command}`);
        exec(command, { maxBuffer: 1024 * 1024 * 100, ...options }, (err, stdout, stderr) => {
            if (err) {
                // tar and pg_restore write progress to stderr on success, so it is
                // only worth surfacing alongside an actual failure.
                if (stderr) console.error(stderr);
                reject(err);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

async function restore() {
    // Extract archive
    console.log('1/5 Extracting archive...');
    fs.mkdirSync(tmpDir, { recursive: true });
    await execPromise(`tar xzf ${shq(path.resolve(archivePath))} -C ${shq(tmpDir)}`);
    console.log('\u2713 Extracted');

    // Confirm the archive holds every member before destroying anything. Each
    // step below deletes its target before writing the replacement, so a
    // missing member discovered mid-restore means unrecoverable data loss.
    const required = ['database.dump', 'uploads', 'extensions'];
    const missing = required.filter(name => !fs.existsSync(path.join(tmpDir, name)));
    if (missing.length > 0) {
        throw new Error(
            `Archive is missing: ${missing.join(', ')}. Expected an archive created by ` +
            `backup_full.js. Nothing has been changed.`
        );
    }
    console.log(`\u2713 Archive verified (${required.join(', ')})`);

    // Stop Directus
    console.log('2/5 Stopping Directus...');
    await execPromise('docker stop d7_directus');
    console.log('\u2713 Directus stopped');

    // Restore database
    console.log('3/5 Restoring database...');
    await execPromise(`docker exec d7_postgres psql -U ${shq(dbUser)} -d postgres -c ${shq(`DROP DATABASE IF EXISTS ${sqlIdent(dbName)};`)}`);
    await execPromise(`docker exec d7_postgres psql -U ${shq(dbUser)} -d postgres -c ${shq(`CREATE DATABASE ${sqlIdent(dbName)};`)}`);
    await execPromise(`docker cp ${shq(path.join(tmpDir, 'database.dump'))} d7_postgres:/tmp/restore.dump`);
    await execPromise(`docker exec d7_postgres pg_restore -U ${shq(dbUser)} -d ${shq(dbName)} --no-owner /tmp/restore.dump`);
    await execPromise('docker exec d7_postgres rm -f /tmp/restore.dump');
    console.log('\u2713 Database restored');

    // Restore uploads (volume-mounted from host)
    console.log('4/5 Restoring uploads...');
    const uploadsDir = path.join(__dirname, '../d7/directus/uploads');
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    await execPromise(`cp -r ${shq(path.join(tmpDir, 'uploads'))} ${shq(uploadsDir)}`);
    console.log('\u2713 Uploads restored');

    // Restore extensions (volume-mounted from host)
    console.log('5/5 Restoring extensions...');
    const extensionsDir = path.join(__dirname, '../d7/directus/extensions');
    fs.rmSync(extensionsDir, { recursive: true, force: true });
    await execPromise(`cp -r ${shq(path.join(tmpDir, 'extensions'))} ${shq(extensionsDir)}`);
    console.log('\u2713 Extensions restored');

    // Start Directus
    console.log('Starting Directus...');
    await execPromise('docker start d7_directus');
    console.log('\u2713 Directus started');

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('\u2713 Cleaned up temp files');

    console.log('\n\u2713 Full restore complete!');
}

restore()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Restore failed:', err);
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        process.exit(1);
    });
