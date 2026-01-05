import { defineEndpoint } from '@directus/extensions-sdk';

export default defineEndpoint((router, { services }) => {
  const { FilesService } = services;

  /**
   * GET /file-by-filename/:filename
   * Example: /file-by-filename/abc.json
   */
  router.get('/:filename', async (req, res) => {
    try {
      const { filename } = req.params;

      const files = new FilesService({
        accountability: null, // public access
        schema: req.schema,
      });

      // Find the most recent file with this title
      const results = await files.readByQuery({
        filter: {
          title: { _eq: filename },
        },
        sort: ['-created_on'],
        limit: 1,
      });

      if (!results || results.length === 0) {
        return res.status(404).json({
          error: 'File not found',
          filename,
        });
      }

      const file = results[0];

      // Redirect to canonical asset URL
      return res.redirect(302, `/assets/${file.id}`);
    } catch (error) {
      console.error('[file-by-filename endpoint]', error);
      return res.status(500).json({
        error: 'Failed to fetch file',
      });
    }
  });
});
