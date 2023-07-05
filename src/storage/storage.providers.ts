import { ConfigService } from '../common/config/config.service';
import LocalBucket from 'any-bucket/local';

export const storageProviders = [
  {
    provide: 'STORAGE_BUCKET',
    useFactory: async (config: ConfigService) => {
      // TODO: support other storage providers: S3, GCS, Azure.
      return new LocalBucket(config.getStoragePath());
    },
    inject: [ConfigService],
  }
]
