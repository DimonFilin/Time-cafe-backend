import { ApiProperty } from '@nestjs/swagger';

export class PingResponseDto {
  @ApiProperty({
    example: 'ok',
    description: 'Response status',
    enum: ['ok'],
  })
  status: 'ok';

  @ApiProperty({
    example: 'pong',
    description: 'Ping response message',
  })
  message: 'pong';

  @ApiProperty({
    example: '2025-11-02T11:31:22.542Z',
    description: 'Timestamp of the ping',
  })
  timestamp: string;
}

