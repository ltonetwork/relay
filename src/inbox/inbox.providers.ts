import { ConfigService } from '../common/config/config.service';
import { S3 } from '@aws-sdk/client-s3';

/* eslint-disable @typescript-eslint/no-var-requires */
const LocalBucket = require('any-bucket/local');
const S3Bucket = require('any-bucket/s3');
/* eslint-enable @typescript-eslint/no-var-requires */

export const inboxProviders = [
  {
    provide: 'INBOX_BUCKET',
    useFactory: async (config: ConfigService, s3: S3) => {
      const path = config.getStoragePath();

      if (path.startsWith('s3://')) {
        return new S3Bucket.default(s3, path.slice(5));
      }

      if (!path.includes(':')) {
        return new LocalBucket.default(path);
      }

      throw new Error(`Unsupported storage service '${path}'`);
    },
    inject: [ConfigService, S3],
  },
];
