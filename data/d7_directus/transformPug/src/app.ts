import { defineOperationApp } from '@directus/extensions-sdk';

export default defineOperationApp({
  id: 'operation-transform-pug',
  name: ' Transform Pug',
  icon: 'box',
  description: 'This takes data and template values in its input and passes it through a pug processor',
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
