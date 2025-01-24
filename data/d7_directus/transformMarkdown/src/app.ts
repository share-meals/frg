import {defineOperationApp} from '@directus/extensions-sdk';

export default defineOperationApp({
  id: 'operation-transform-markdown',
  name: 'Transform Markdown',
  icon: 'box',
  description: 'This takes input, parses it as markdown, and sends it to the output.',
  overview: ({config}) => [
    {
      label: 'Config',
      text: config
    }
  ],
  options: [
    {
      field: 'config',
      name: 'Config',
      type: 'json',
      meta: {
	width: 'full',
	interface: 'json'
      }
    }
  ],
});
