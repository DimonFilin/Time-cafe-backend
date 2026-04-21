import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SendChatMessageDto {
  @ApiPropertyOptional({ description: 'Message text', maxLength: 4000 })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  text?: string;

  @ApiPropertyOptional({
    description: 'Attachment IDs uploaded for this message',
    type: [String],
    maxItems: 4,
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];
}
