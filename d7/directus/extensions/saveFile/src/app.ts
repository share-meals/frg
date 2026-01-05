import { defineOperationApp } from '@directus/extensions-sdk';

export default defineOperationApp({
  id: 'saveFile',
  name: 'Save File',
  icon: 'save',
  description:
    'Save the Flow payload as a file in Directus. ⚠️ The file TITLE is used as the canonical identifier — do NOT rename the file in the Admin UI.',

  overview: ({ file_id, asset_url, overwritten }) => [
    {
      label: 'File ID',
      text: file_id ?? '(none)',
      copyable: true,
    },
    {
      label: 'Overwritten',
      text: overwritten ? 'Yes' : 'No',
    },
    {
      label: 'Asset URL',
      text: asset_url ?? '(none)',
      copyable: true,
    },
  ],

  options: [
    {
      field: 'filename',
      name: 'Filename (also used as Title)',
      type: 'string',
      meta: {
        required: true,
        note: '⚠️ This value is used to overwrite existing files. Do NOT change the file title later.',
      },
    },
    {
      field: 'encoding',
      name: 'Encoding',
      type: 'string',
      schema: {
        default_value: 'utf8',
      },
      meta: {
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: 'UTF-8', value: 'utf8' },
            { text: 'Base64', value: 'base64' },
          ],
        },
      },
    },
    {
      field: 'folder',
      name: 'Folder ID (optional)',
      type: 'string',
    },
  ],
});
