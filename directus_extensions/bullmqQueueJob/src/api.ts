import {defineOperationApi} from '@directus/extensions-sdk';
import {Queue} from 'bullmq';
import {Redis} from 'ioredis';

// TODO: better typing
type Options = {
  config: any;
};

export default defineOperationApi<Options>({
  id: 'bullmqQueueJob',
  handler: async ({config}, {data, env}) => {
    const connection = new Redis({
      host: env.MQ_REDIS_HOST,
      port: env.MQ_REDIS_PORT
    });

    const queue = new Queue(data.$last.queue, {connection});
    const job = await queue.add(data.$last.name, data.$last.payload);
    return job.id;
  },
});
