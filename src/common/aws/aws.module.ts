import { Module } from '@nestjs/common';
import { S3 } from '@aws-sdk/client-s3';
import { awsProviders } from './aws.providers';

@Module({
  providers: [...awsProviders],
  exports: [S3],
})
export class AwsModule {}
