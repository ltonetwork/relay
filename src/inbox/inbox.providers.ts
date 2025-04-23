import { ConfigService } from '../common/config/config.service';
import LocalBucket from 'any-bucket/local';
import { S3 } from '@aws-sdk/client-s3';
import S3Bucket from 'any-bucket/s3';

export const inboxProviders = [
  {
    provide: 'INBOX_BUCKET',
    useFactory: async (config: ConfigService, s3: S3) => {
      const path = config.getStoragePath();

      if (path.startsWith('s3://')) {
        return new S3Bucket(s3, path.slice(5));
      }

      if (!path.includes(':')) {
        return new LocalBucket(path);
      }

      throw new Error(`Unsupported storage service '${path}'`);
    },
    inject: [ConfigService, S3],
  },
  {
    provide: 'INBOX_THUMBNAIL_BUCKET',
    useFactory: async (config: ConfigService, s3: S3) => {
      const path = config.getThumbnailStoragePath();

      if (path.startsWith('s3://')) {
        return new S3Bucket(s3, path.slice(5));
      }

      if (!path.includes(':')) {
        return new LocalBucket(path);
      }

      throw new Error(`Unsupported storage service '${path}'`);
    },
    inject: [ConfigService, S3],
  },
];
