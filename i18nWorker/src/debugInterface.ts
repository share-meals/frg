import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import readlineSync from 'readline-sync';
import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Redis connection
const connection = new Redis({
  host: process.env.MQ_HOST,
  port: process.env.MQ_PORT,
});

// Function to drain the queue
async function drainQueue(queueName: string): Promise<void> {
  const queue = new Queue(queueName, { connection });
  await queue.drain();
  console.log(`Queue ${queueName} has been drained.`);
}

// Function to obliterate the queue
async function obliterateQueue(queueName: string): Promise<void> {
  const queue = new Queue(queueName, { connection });

  // Remove all jobs from the queue
  await queue.obliterate({ force: true });
  console.log(`Queue ${queueName} has been obliterated.`);
}

// Main function to handle user input and perform actions
async function main(): Promise<void> {
  const queueName = readlineSync.question('Enter queue name: ');
  const action = readlineSync.keyInSelect(['drain', 'obliterate'], 'Select action (drain or obliterate): ');

  if (action === -1) {
    console.log('No action selected, exiting.');
    return;
  }

  try {
    if (action === 0) {
      // Drain action
      await drainQueue(queueName);
    } else if (action === 1) {
      // Obliterate action
      await obliterateQueue(queueName);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    connection.quit();
  }
}

main().catch(error => {
  console.error('An unexpected error occurred:', error);
});
