import { ApiProperty } from '@nestjs/swagger';

export class CardResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '1234' })
  last4Digits: string;

  @ApiProperty({ example: 'visa' })
  cardType: string;

  @ApiProperty({ example: 12 })
  expiryMonth: number;

  @ApiProperty({ example: 2025 })
  expiryYear: number;

  @ApiProperty({ example: true })
  isDefault: boolean;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 'John Doe', required: false })
  holderName?: string;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;
}
