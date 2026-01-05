import { defineOperationApi } from '@directus/extensions-sdk';
import { Readable } from 'node:stream';

type Input = {
  filename: string;
  encoding?: 'utf8' | 'base64';
  folder?: string;
};

export default defineOperationApi({
  id: 'saveFile',

  handler: async (rawInput, context) => {
    const input = rawInput as Input;

    /**
     * --------------------------------------------------
     * 1. Get output of the PREVIOUS Flow step (correct)
     * --------------------------------------------------
     */
    const payload = context.data.$last;

    if (payload === undefined) {
      throw new Error(
        '[saveFile] No data found in context.data (previous step output)'
      );
    }

    /**
     * --------------------------------------------------
     * 2. Convert payload into file contents
     * --------------------------------------------------
     */
    const contents =
      typeof payload === 'string'
        ? payload
        : JSON.stringify(payload, null, 2);

    const buffer =
      input.encoding === 'base64'
        ? Buffer.from(contents, 'base64')
        : Buffer.from(contents, 'utf8');

    const stream = Readable.from(buffer);

    /**
     * --------------------------------------------------
     * 3. Initialize FilesService
     * --------------------------------------------------
     */
    const schema = await context.getSchema();
    const { FilesService } = context.services;

    const files = new FilesService({
      accountability: null,
      schema,
    });

    /**
     * --------------------------------------------------
     * 4. Overwrite existing file by TITLE (filename)
     * --------------------------------------------------
     */
    const existing = await files.readByQuery({
      filter: {
        title: { _eq: input.filename },
        folder: { _eq: input.folder ?? null },
      },
      limit: 1,
    });

    const [previous] = existing ?? [];

    if (previous) {
      await files.deleteOne(previous.id);
    }

    /**
     * --------------------------------------------------
     * 5. Upload new file
     * --------------------------------------------------
     */
    const fileId = await files.uploadOne(stream, {
      storage: 'local',
      filename_download: input.filename,
      title: input.filename, // canonical identifier
      type: 'application/json',
      folder: input.folder ?? null,
    });

    /**
     * --------------------------------------------------
     * 6. Return operation output
     * --------------------------------------------------
     */
    return {
      file_id: fileId,
      overwritten: Boolean(previous),
      asset_url: `/assets/${fileId}`,
    };
  },
});
