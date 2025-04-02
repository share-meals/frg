const { exec } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../env/d7.env') });

// Check for full backup flag
const fullBackup = process.argv.includes('--full');

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

const dateString = new Date().toISOString().split('T')[0];
const backupType = fullBackup ? 'full' : 'default';
const gzFileName = `/tmp/${dateString}${fullBackup ? '-full' : ''}.sql.gz`;

console.log(`Starting ${backupType} backup process for database ${dbName}...`);

// Initialize S3 client
const s3Client = new S3Client({ region: awsRegion });

async function uploadToS3(filePath) {
    const fileStream = fs.createReadStream(filePath);
    
    try {
        console.log(`Uploading ${filePath} to S3...`);
        
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: bucketName,
                Key: path.basename(filePath),
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
        console.log(`✓ Successfully uploaded to s3://${bucketName}/${path.basename(filePath)}`);
        return true;
    } catch (err) {
        console.error('S3 upload error:', err);
        return false;
    }
}

async function createBackup() {
    // Build pg_dump command
    const dumpArgs = [
        `-U ${dbUser}`,
        `-d ${dbName}`,
        '--clean',
        '--create',
        '--if-exists'
    ];

    // Only exclude table if not doing full backup
    if (!fullBackup) {
        dumpArgs.push('--exclude-table-data=public.directus_revisions');
    }

    const dumpCommand = `pg_dump ${dumpArgs.join(' ')}`;
    const fullCommand = `docker exec d7_postgres bash -c "${dumpCommand} | gzip -9" > ${gzFileName}`;

    console.log(`Executing: ${fullCommand}`);

    return new Promise((resolve, reject) => {
        const backupProcess = exec(fullCommand, { maxBuffer: 1024 * 1024 * 50 });

        backupProcess.on('error', (err) => {
            console.error('Process error:', err);
            cleanupFailedBackup();
            reject(err);
        });

        backupProcess.on('close', async (code, signal) => {
            if (code !== 0) {
                console.error(`✗ Backup failed with code ${code} and signal ${signal}`);
                cleanupFailedBackup();
                reject(new Error(`Backup process failed with code ${code}`));
                return;
            }

            const fileSizeMB = (fs.statSync(gzFileName).size / 1024 / 1024).toFixed(2);
            console.log(`✓ ${backupType} backup created: ${gzFileName} (${fileSizeMB} MB)`);

            try {
                const uploadSuccess = await uploadToS3(gzFileName);
                if (!uploadSuccess) {
                    reject(new Error('S3 upload failed'));
                    return;
                }
                resolve();
            } catch (err) {
                reject(err);
            } finally {
                // Clean up local file after upload
                try {
                    fs.unlinkSync(gzFileName);
                    console.log('Cleaned up local backup file');
                } catch (err) {
                    console.error('Could not clean up local file:', err);
                }
            }
        });
    });
}

function cleanupFailedBackup() {
    if (fs.existsSync(gzFileName)) {
        try {
            fs.unlinkSync(gzFileName);
            console.log('Cleaned up failed backup file');
        } catch (err) {
            console.error('Could not clean up backup file:', err);
        }
    }
}

// Run the backup
createBackup()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Backup failed:', err);
        process.exit(1);
    });

// Handle process termination
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, terminating...');
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, terminating...');
    process.exit(1);
});
