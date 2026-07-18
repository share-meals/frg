import * as AWS from '@aws-sdk/client-s3';
import { Crypto } from '@peculiar/webcrypto'; // needed for S3
import { defineOperationApi } from '@directus/extensions-sdk';

// global.crypto = new Crypto()

type Options = {};

export default defineOperationApi<Options>({
  id: 'operation-upload-to-r2',
  handler: async (_options, { data, env }) => {
    const client = new AWS.S3({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });

    const uploads = Array.isArray(data.$last) ? data.$last : [data.$last];

    for (const payload of uploads) {
      const params: AWS.PutObjectCommandInput = {
        Bucket: payload.bucket || env.R2_BUCKET,
        Key: payload.key,
        Body: payload.body,
        ContentType: payload.contentType,
      };
      if (payload.cacheControl) params.CacheControl = payload.cacheControl;

      const maxAttempts = 3;
      let lastError: unknown;
      let uploaded = false;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await client.putObject(params);
          uploaded = true;
          break;
        } catch (error) {
          lastError = error;
          const err = error as { code?: string; name?: string };
          const msg = err.code || err.name || 'unknown';
          console.error(`[uploadToR2] putObject attempt ${attempt}/${maxAttempts} failed (${msg}) for key ${params.Key}`);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
      }
      if (!uploaded) throw lastError;
    }
    return data.$last;
  },
});
