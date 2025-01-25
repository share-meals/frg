require('dotenv').config({ path: '../env/d7.env' });
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const os = require('os');
const zlib = require('zlib');

const s3Client = new S3Client({ region: process.env.BACKUP_REGION });
const BUCKET_NAME = process.env.BACKUP_BUCKET_NAME;
const S3_OBJECT_KEY = `${new Date().toISOString().split('T')[0]}.tar.gz`;  // Gzipped file

const containerName = 'd7_postgres';
const dbName = process.env.D7_POSTGRES_DB;
const dbUser = process.env.D7_POSTGRES_USER;

if (!dbName || !dbUser || !BUCKET_NAME || !process.env.BACKUP_REGION) {
  console.error('Error: Environment variables D7_POSTGRES_DB, D7_POSTGRES_USER, BACKUP_BUCKET_NAME, and BACKUP_REGION must be set.');
  process.exit(1);
}

const tempFilePath = path.join(os.tmpdir(), `${new Date().toISOString().split('T')[0]}.tar`);  // Temp file path for the uncompressed dump

// Construct the docker exec command
const dockerCommand = `docker exec ${containerName} pg_dump -U ${dbUser} -c --format=tar ${dbName} -f /tmp/${S3_OBJECT_KEY}`;

const pgDumpProcess = exec(dockerCommand);

// Log stderr from pg_dump process
pgDumpProcess.stderr.on('data', (data) => {
  console.error(`pg_dump stderr: ${data.toString()}`);
});

pgDumpProcess.on('error', (err) => {
  console.error(`Error executing pg_dump: ${err.message}`);
});

pgDumpProcess.on('close', (code) => {
  if (code === 0) {
    // After successful pg_dump, copy the file from the container to local disk
    copyFileFromContainerToLocal();
  } else {
    console.error(`pg_dump process exited with code ${code}`);
  }
});

// Copy the dump file from Docker container to the local file system
function copyFileFromContainerToLocal() {
  const copyCommand = `docker cp ${containerName}:/tmp/${S3_OBJECT_KEY} ${tempFilePath}`;

  exec(copyCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error copying file from container: ${error.message}`);
      return;
    }

    if (stderr) {
      console.error(`stderr while copying file: ${stderr}`);
    }

    console.log(`File copied successfully to ${tempFilePath}`);
    gzipFile();  // Gzip the file before uploading to S3
  });
}

// Gzip the file
function gzipFile() {
  const gzip = zlib.createGzip();
  const input = fs.createReadStream(tempFilePath);
  const output = fs.createWriteStream(`${tempFilePath}.gz`);

  input.pipe(gzip).pipe(output);

  output.on('finish', () => {
    console.log('Gzipped file created successfully');
    uploadToS3();  // Upload the gzipped file to S3
  });

  output.on('error', (err) => {
    console.error(`Error gzipping the file: ${err.message}`);
  });
}

// Upload to S3 using Upload class from @aws-sdk/lib-storage
async function uploadToS3() {
  try {
    console.log('Starting S3 upload...');

    const fileStream = fs.createReadStream(`${tempFilePath}.gz`);  // Read the gzipped file

    const uploadParams = {
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: S3_OBJECT_KEY,
        Body: fileStream,
        ContentType: 'application/gzip',  // Set Content-Type to gzip
      },
    };

    const upload = new Upload(uploadParams);
    const data = await upload.done();
    console.log(`Upload successful: ${data.Location}`);
    
    deleteTempFile();  // Delete the temp file after upload is successful
  } catch (error) {
    console.error(`Error uploading to S3: ${error.message}`);
  }
}

// Delete the temporary file after the upload is completed
function deleteTempFile() {
  fs.unlink(tempFilePath, (err) => {
    if (err) {
      console.error(`Error deleting temporary file: ${err.message}`);
    } else {
      console.log('Temporary file deleted successfully');
    }
  });

  // Also delete the gzipped file
  fs.unlink(`${tempFilePath}.gz`, (err) => {
    if (err) {
      console.error(`Error deleting gzipped file: ${err.message}`);
    } else {
      console.log('Gzipped file deleted successfully');
    }
  });
}
