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

  @ApiPropertyOptional({
    description: 'Customer info',
    example: {
      id: 'uuid',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      email: 'ivan@example.com',
      phone: '+375291234567',
      avatarUrl: 'https://example.com/avatar.jpg',
    },
  })
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
  };

  @ApiPropertyOptional({
    description: 'Order info',
    example: {
      id: 'uuid',
      orderNumber: 'A-1001',
      status: 'CONFIRMED',
      totalAmount: '25.50',
      createdAt: '2026-04-28T12:00:00.000Z',
      appointmentId: 'uuid',
    },
  })
  order?: {
    id: string;
    orderNumber?: string | null;
    status?: string;
    totalAmount?: string | null;
    createdAt: Date;
    appointmentId?: string | null;
  };

  @ApiPropertyOptional({
    description: 'Booking info with related orders',
    example: {
      id: 'uuid',
      dateTime: '2026-04-29T18:00:00.000Z',
      duration: 120,
      status: 'confirmed',
      orders: [
        {
          id: 'uuid',
          orderNumber: 'A-1001',
          status: 'CONFIRMED',
          totalAmount: '25.50',
        },
      ],
    },
  })
  appointment?: {
    id: string;
    dateTime: Date;
    duration: number;
    status: string;
    notes?: string | null;
    orders: Array<{
      id: string;
      orderNumber?: string | null;
      status?: string;
      totalAmount?: string | null;
      createdAt: Date;
    }>;
  } | null;

  @ApiProperty()
  updatedAt: Date;
}
