import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ChatAuthorType,
  ChatMessageType,
  ChatNotificationMode,
} from '@prisma/client';

export class ChatAttachmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  sortOrder: number;
}

export class ChatMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  chatId: string;

  @ApiProperty({ enum: ChatAuthorType })
  authorType: ChatAuthorType;

  @ApiPropertyOptional()
  authorUserId?: string | null;

  @ApiPropertyOptional()
  authorWorkerId?: string | null;

  @ApiProperty({ enum: ChatMessageType })
  messageType: ChatMessageType;

  @ApiPropertyOptional()
  text?: string | null;

  @ApiProperty({ type: [ChatAttachmentDto] })
  attachments: ChatAttachmentDto[];

  @ApiProperty()
  createdAt: Date;
}

export class ChatSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty()
  cafeId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  isEnabled: boolean;

  @ApiProperty({ enum: ChatNotificationMode })
  notificationMode: ChatNotificationMode;

  @ApiProperty()
  unreadCount: number;

  @ApiPropertyOptional({ type: ChatMessageDto })
  lastMessage?: ChatMessageDto | null;

  @ApiProperty()
  updatedAt: Date;
}
