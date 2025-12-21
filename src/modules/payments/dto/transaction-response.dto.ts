import { ApiProperty } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class TransactionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.PAYMENT })
  type: TransactionType;

  @ApiProperty({
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @ApiProperty({ example: '1000.00' })
  amount: string;

  @ApiProperty({ example: 'RUB' })
  currency: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    required: false,
  })
  orderId?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    required: false,
  })
  cardId?: string;

  @ApiProperty({ example: 'stripe', required: false })
  provider?: string;

  @ApiProperty({ example: 'ch_1234567890', required: false })
  providerTransactionId?: string;

  @ApiProperty({ example: 'Payment for order #123', required: false })
  description?: string;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;
}
