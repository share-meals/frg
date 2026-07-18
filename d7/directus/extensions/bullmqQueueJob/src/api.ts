import {defineOperationApi} from '@directus/extensions-sdk';
import {Queue} from 'bullmq';
import {Redis} from 'ioredis';

// TODO: better typing
type Options = {
  config: any;
};

export default defineOperationApi<Options>({
  id: 'operation-queue-bullmq-job',
  handler: async ({config}, {data, env}) => {
    const connection = new Redis({
      host: env.MQ_REDIS_HOST ?? '127.0.0.1',
      port: Number(env.MQ_REDIS_PORT ?? 6379),
      password: env.MQ_REDIS_PASSWORD || undefined,
    });
    const queue = new Queue(data.$last.queue, {connection});
    const job = await queue.add(data.$last.name, data.$last.payload);
    return job.id;
  },
});
