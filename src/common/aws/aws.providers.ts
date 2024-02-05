import { S3 } from '@aws-sdk/client-s3';

export const awsProviders = [
  {
    provide: S3,
    useFactory: async () => {
      return new S3();
    },
  }
];
