import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {Readable} from 'stream';
import * as dotenv from 'dotenv';
dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

interface GetS3Object {
  bucket: string,
  key: string
}

interface PutS3Object extends GetS3Object {
  body: string,
  contentType: string,
}

export async function getS3Object({bucket, key}: GetS3Object) {
  try{
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    
    const response = await s3.send(command);
    if(response.Body instanceof Readable){
      const data = await streamToString(response.Body as Readable);
      return data;
    }else{
      // do something
    }
  }catch(error: unknown){
    if(error instanceof Error){
      throw new Error(error.message);
    }
  }
}

export async function putS3Object({
  body,
  bucket,
  contentType,
  key,
}: PutS3Object){
  try{
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    const response = await s3.send(command);
    return response;
  }catch(error: unknown){
    if(error instanceof Error){
      throw new Error(error.message);
    }
  }
}

async function streamToString(stream: Readable){
  const chunks = [];
  for await(const chunk of stream){
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}
