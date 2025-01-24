#!/bin/bash

# Load environment variables from backup.env file
if [ -f "./backup.env" ]; then
  source ./backup.env
else
  echo "Error: backup.env file not found."
  exit 1
fi

# Check if the 'D7_DIRECTUS_SCHEMA_PATH' variable is set
if [ -z "$D7_DIRECTUS_SCHEMA_PATH" ]; then
  echo "Error: D7_DIRECTUS_SCHEMA_PATH is not defined in backup.env."
  exit 1
fi

# Check if the 'AWS_S3_BUCKET' and 'AWS_REGION' variables are set
if [ -z "$AWS_S3_BUCKET" ]; then
  echo "Error: AWS_S3_BUCKET is not defined in backup.env."
  exit 1
fi

if [ -z "$AWS_REGION" ]; then
  echo "Error: AWS_REGION is not defined in backup.env."
  exit 1
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "Error: AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are not defined in backup.env."
  exit 1
fi

# Check if the directory exists
if [ ! -d "$D7_DIRECTUS_SCHEMA_PATH" ]; then
  echo "Error: The specified path '$D7_DIRECTUS_SCHEMA_PATH' does not exist."
  exit 1
fi

# Check if the container 'd7_directus' is running
if ! docker ps | grep -q 'd7_directus'; then
  echo "Error: The container 'd7_directus' is not running."
  exit 1
fi

# Run the schema export command (export-schema)
echo "Running 'npx directus schema-sync export-schema' in the 'd7_directus' container..."
docker exec -it d7_directus npx directus schema-sync export-schema

# Check if the schema export was successful
if [ $? -eq 0 ]; then
  echo "Schema export completed successfully."
else
  echo "Error: Schema export failed."
  exit 1
fi

# Run the data export command (export)
echo "Running 'npx directus schema-sync export' in the 'd7_directus' container..."
docker exec -it d7_directus npx directus schema-sync export

# Check if the data export was successful
if [ $? -eq 0 ]; then
  echo "Data export completed successfully."
else
  echo "Error: Data export failed."
  exit 1
fi

# Get the current date in YYYY-MM-DD format for the backup file name
BACKUP_FILE="$(date +'%Y-%m-%d').tar.gz"

# Create a tar.gz archive of the specified directory after both exports
echo "Creating a tar.gz archive of the directory '$D7_DIRECTUS_SCHEMA_PATH'..."
tar -czf "$BACKUP_FILE" -C "$D7_DIRECTUS_SCHEMA_PATH" .

# Check if the tar command was successful
if [ $? -eq 0 ]; then
  echo "Backup archive '$BACKUP_FILE' created successfully."
else
  echo "Error: Failed to create backup archive."
  exit 1
fi

# Upload the backup file to S3 using AWS CLI
echo "Uploading the backup archive '$BACKUP_FILE' to S3 bucket '$AWS_S3_BUCKET'..."

# Using AWS CLI to upload the file to S3
aws s3 cp "$BACKUP_FILE" "s3://$AWS_S3_BUCKET/$BACKUP_FILE" --region "$AWS_REGION" --profile "$AWS_PROFILE"

# Check if the upload was successful
if [ $? -eq 0 ]; then
  echo "Backup archive uploaded to S3 successfully."
else
  echo "Error: Failed to upload the backup archive to S3."
  exit 1
fi

# Delete the local tar file after successful upload
echo "Deleting the local tar file '$BACKUP_FILE'..."
rm -f "$BACKUP_FILE"

# Check if the file was deleted successfully
if [ $? -eq 0 ]; then
  echo "Local tar file '$BACKUP_FILE' deleted successfully."
else
  echo "Error: Failed to delete the local tar file."
  exit 1
fi
