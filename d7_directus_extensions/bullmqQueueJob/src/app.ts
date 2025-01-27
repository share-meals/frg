import { defineOperationApp } from '@directus/extensions-sdk';

export default defineOperationApp({
  id: 'operation-queue-bullmq-job',
  name: 'BullMQ - Queue Job',
  icon: 'box',
  overview: ({config}) => [
    {
      label: 'Config',
      text: config
    }
  ],
  options: [
    {
      field: 'config',
      name: 'Queue Config',
      type: 'json',
      meta: {
	width: 'full',
	interface: 'json'
      }
    }
  ],
});
