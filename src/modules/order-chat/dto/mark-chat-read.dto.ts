import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class MarkChatReadDto {
  @ApiPropertyOptional({ description: 'Last read message ID' })
  @IsOptional()
  @IsUUID()
  messageId?: string;
}
