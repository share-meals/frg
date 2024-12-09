/*
   TODO: lookup target language name based on ISO code
   TODO: add disclaimer at the start
*/

import axios, {AxiosError} from 'axios';
import {
  getS3Object,
  putS3Object,
} from './s3';
import {
  Job,
  Worker,
} from 'bullmq';
import {Redis} from 'ioredis';
import * as dotenv from 'dotenv';
dotenv.config();

const timestampOptions: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: true
};

function getNow() {
  return new Intl.DateTimeFormat('en-US', timestampOptions).format(new Date());
}

async function processJob(job: Job) {
  // get original file from S3
  let file: string | undefined;
  try{
    file = await getS3Object({
      bucket: job.data.bucket,
      key: job.data.key,
    });
  }catch(error){
    if(error instanceof Error){
      throw error;
    }
  }
  job.updateProgress(33);
  job.log(`${getNow()} - got S3 file`);

  // translate it!
  let body: string = '';
  try{
    body = (await axios.post(
      process.env.LIBRETRANSLATE_URL,
      {
	q: file,
	source: job.data.languages.source,
	target: job.data.languages.target,
	format: 'html'
      },
      {headers: {'Content-Type': 'application/json'}}))
    .data.translatedText;
  }catch(error: unknown){
    if(axios.isAxiosError(error)){
      // TODO: more thorough error checking
      throw new Error(error.response!.data.error);
    }
  }

  job.updateProgress(66);
  job.log(`${getNow()} - translated file`);
  
  // send it back to S3
  const response = await putS3Object({
    body,
    bucket: job.data.bucket,    
    contentType: 'text/html; charset=utf-8',
    key: `${job.data.slug}_${job.data.languages.target}.html`,
  });
  if(response && response.$metadata.httpStatusCode === 200){
    job.updateProgress(100);
    job.log(`${getNow()} - uploaded translated file to S3`);
    return;
  }else{
    // TODO: do something
  }
}

const connection = new Redis({
  host: process.env.MQ_HOST,
  port: process.env.MQ_PORT,
  maxRetriesPerRequest: null,
});
const worker = new Worker(
  'fpc web i18n',
  processJob,
  {connection}
);
