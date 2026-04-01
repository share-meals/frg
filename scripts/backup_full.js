const { exec, execSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../env/d7.env') });

// Validate required environment variables
const requiredVars = ['D7_POSTGRES_DB', 'D7_POSTGRES_USER', 'BACKUP_REGION', 'BACKUP_BUCKET_NAME'];
for (const varName of requiredVars) {
    if (!process.env[varName]) {
        console.error(`Error: ${varName} environment variable is required`);
        process.exit(1);
    }
}

const {
    D7_POSTGRES_DB: dbName,
    D7_POSTGRES_USER: dbUser,
    BACKUP_REGION: awsRegion,
    BACKUP_BUCKET_NAME: bucketName
} = process.env;

const dateString = new Date().toISOString().replace(/[:.]/g, '-');
const tmpDir = `/tmp/directus-backup-${dateString}`;
const archiveName = `${dateString}-full-backup.tar.gz`;
const archivePath = `/tmp/${archiveName}`;

console.log(`Starting full backup at ${dateString}...`);

// Initialize S3 client
const s3Client = new S3Client({ region: awsRegion });

function execPromise(command, options = {}) {
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 1024 * 1024 * 100, ...options }, (err, stdout, stderr) => {
            if (err) {
                console.error(`stderr: ${stderr}`);
                reject(err);
                return;
            }
            resolve(stdout.trim());
        });
    });
}

async function uploadToS3(filePath) {
    const fileStream = fs.createReadStream(filePath);

    try {
        console.log(`Uploading ${filePath} to S3...`);

        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: bucketName,
                Key: `full-backups/${path.basename(filePath)}`,
                Body: fileStream,
                ContentType: 'application/gzip'
            },
            queueSize: 4,
            partSize: 1024 * 1024 * 5
        });

        upload.on('httpUploadProgress', (progress) => {
            if (progress.total) {
                console.log(`Upload progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            }
        });

        await upload.done();
        console.log(`\u2713 Successfully uploaded to s3://${bucketName}/full-backups/${path.basename(filePath)}`);
        return true;
    } catch (err) {
        console.error('S3 upload error:', err);
        return false;
    }
}

async function createFullBackup() {
    // Create temp directory
    fs.mkdirSync(tmpDir, { recursive: true });

    // 1. Database dump
    console.log('1/3 Dumping database...');
    const dumpFile = path.join(tmpDir, 'database.dump');
    const dumpCommand = `docker exec d7_postgres pg_dump -U ${dbUser} -d ${dbName} -F c -f /tmp/backup.dump && docker cp d7_postgres:/tmp/backup.dump ${dumpFile}`;
    await execPromise(dumpCommand);
    const dbSize = (fs.statSync(dumpFile).size / 1024 / 1024).toFixed(2);
    console.log(`\u2713 Database dump: ${dbSize} MB`);

    // 2. Uploads
    console.log('2/3 Copying uploads...');
    await execPromise(`docker cp d7_directus:/directus/uploads ${path.join(tmpDir, 'uploads')}`);
    console.log('\u2713 Uploads copied');

    // 3. Extensions (exclude node_modules)
    console.log('3/3 Copying extensions...');
    const extTmp = path.join(tmpDir, 'extensions');
    await execPromise(`docker cp d7_directus:/directus/extensions ${extTmp}`);
    // Remove node_modules from extensions to save space
    const extDirs = fs.readdirSync(extTmp);
    for (const dir of extDirs) {
        const nmPath = path.join(extTmp, dir, 'node_modules');
        if (fs.existsSync(nmPath)) {
            fs.rmSync(nmPath, { recursive: true, force: true });
            console.log(`  Stripped node_modules from ${dir}`);
        }
    }
    console.log('\u2713 Extensions copied (without node_modules)');

    // Create single tar.gz archive
    console.log('Creating archive...');
    await execPromise(`tar czf ${archivePath} -C ${tmpDir} .`);
    const archiveSize = (fs.statSync(archivePath).size / 1024 / 1024).toFixed(2);
    console.log(`\u2713 Archive created: ${archiveName} (${archiveSize} MB)`);

    // Upload to S3
    const uploadSuccess = await uploadToS3(archivePath);
    if (!uploadSuccess) {
        console.warn(`\u26a0 S3 upload failed. Archive kept at: ${archivePath}`);
    }

    // Cleanup temp dir (but keep archive if S3 failed)
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await execPromise('docker exec d7_postgres rm -f /tmp/backup.dump');
    if (uploadSuccess) {
        fs.unlinkSync(archivePath);
        console.log('Cleaned up temp files');
        console.log(`\n\u2713 Full backup complete: s3://${bucketName}/full-backups/${archiveName}`);
    } else {
        console.log(`\n\u2713 Local backup complete: ${archivePath}`);
    }
}

createFullBackup()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Backup failed:', err);
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        process.exit(1);
    });

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, terminating...');
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, terminating...');
    process.exit(1);
});
