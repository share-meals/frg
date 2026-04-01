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

function execPromise(command, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`> ${command}`);
        exec(command, { maxBuffer: 1024 * 1024 * 100, ...options }, (err, stdout, stderr) => {
            if (stderr) console.error(stderr);
            if (err) {
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
    await execPromise(`tar xzf ${path.resolve(archivePath)} -C ${tmpDir}`);
    console.log('\u2713 Extracted');

    // Stop Directus
    console.log('2/5 Stopping Directus...');
    await execPromise('docker stop d7_directus');
    console.log('\u2713 Directus stopped');

    // Restore database
    console.log('3/5 Restoring database...');
    await execPromise(`docker exec d7_postgres psql -U ${dbUser} -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`);
    await execPromise(`docker exec d7_postgres psql -U ${dbUser} -d postgres -c "CREATE DATABASE ${dbName};"`);
    await execPromise(`docker cp ${path.join(tmpDir, 'database.dump')} d7_postgres:/tmp/restore.dump`);
    await execPromise(`docker exec d7_postgres pg_restore -U ${dbUser} -d ${dbName} --no-owner /tmp/restore.dump`);
    await execPromise('docker exec d7_postgres rm -f /tmp/restore.dump');
    console.log('\u2713 Database restored');

    // Restore uploads (volume-mounted from host)
    console.log('4/5 Restoring uploads...');
    const uploadsDir = path.join(__dirname, '../d7/directus/uploads');
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    await execPromise(`cp -r ${path.join(tmpDir, 'uploads')} ${uploadsDir}`);
    console.log('\u2713 Uploads restored');

    // Restore extensions (volume-mounted from host)
    console.log('5/5 Restoring extensions...');
    const extensionsDir = path.join(__dirname, '../d7/directus/extensions');
    fs.rmSync(extensionsDir, { recursive: true, force: true });
    await execPromise(`cp -r ${path.join(tmpDir, 'extensions')} ${extensionsDir}`);
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
