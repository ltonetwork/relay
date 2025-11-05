import { ApiProperty } from '@nestjs/swagger';

export class MessageSummary {
  @ApiProperty()
  public readonly hash: string;

  @ApiProperty()
  public readonly size: number;

  @ApiProperty()
  public readonly type: string;

  @ApiProperty()
  public readonly timestamp: number;

  @ApiProperty()
  public readonly sender: string;

  @ApiProperty()
  public readonly recipient: string;

  @ApiProperty({ required: false })
  public readonly meta?: {
    type: string;
    title: string;
    description: string;
    thumbnail?: string;
  };
}
