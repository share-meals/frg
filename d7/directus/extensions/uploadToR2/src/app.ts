import { defineOperationApp } from '@directus/extensions-sdk';

export default defineOperationApp({
  id: 'operation-upload-to-r2',
  name: 'Upload to R2',
  icon: 'cloud_upload',
  description: 'Upload a file to Cloudflare R2 as part of a flow',
  overview: () => [],
  options: [],
});
