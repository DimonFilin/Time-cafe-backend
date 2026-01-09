import { ApiProperty } from '@nestjs/swagger';

export class BalanceTransactionDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'txn_123456789',
  })
  id: string;

  @ApiProperty({
    description: 'Transaction type',
    enum: ['TOP_UP', 'PAYMENT', 'REFUND'],
    example: 'TOP_UP',
  })
  type: 'TOP_UP' | 'PAYMENT' | 'REFUND';

  @ApiProperty({
    description: 'Transaction amount',
    example: '100.50',
  })
  amount: string;

  @ApiProperty({
    description: 'Transaction description',
    example: 'Balance top-up using card ending in 1234',
  })
  description: string;

  @ApiProperty({
    description: 'Transaction creation date',
    example: '2025-01-08T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Card ID used for transaction (optional)',
    example: 'card_123456789',
    required: false,
  })
  cardId?: string;

  @ApiProperty({
    description: 'Last 4 digits of the card used (optional)',
    example: '1234',
    required: false,
  })
  cardLast4Digits?: string;
}

export class BalanceHistoryResponseDto {
  @ApiProperty({
    description: 'List of balance transactions',
    type: [BalanceTransactionDto],
  })
  transactions: BalanceTransactionDto[];

  @ApiProperty({
    description: 'Total number of transactions',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of transactions per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 2,
  })
  totalPages: number;
}
