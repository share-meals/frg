import { defineOperationApp } from '@directus/extensions-sdk';

export default defineOperationApp({
  id: 'operation-upload-to-s3',
  name: 'Upload to S3',
  icon: 'cloud_upload',
  description: 'This allows you to upload a file to S3 as part of a flow',
  overview: ({bucket, contentType}) => [],
  options: [],
});
