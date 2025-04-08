import * as AWS from '@aws-sdk/client-s3';
import {Crypto} from '@peculiar/webcrypto'; // needed for S3
import {defineOperationApi} from '@directus/extensions-sdk';

//global.crypto = new Crypto()

type Options = {};

export default defineOperationApi<Options>({
  id: 'operation-upload-to-s3',
  handler: async (options, {data, env}) => {
    const s3 = new AWS.S3({
      region: env.AWS_S3_REGION,
      credentials: {
	accessKeyId: env.AWS_S3_ACCESS_KEY_ID,
	secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY
      }
    });

    const params = {
      Bucket: data.$last.bucket,
      Key: data.$last.key,
      Body: data.$last.body,
      ContentType: data.$last.contentType
    }

    try{
      await s3.putObject(params);
    }catch(error){
      // todo: something with error
    }
    return data.$last;    
  },
});
