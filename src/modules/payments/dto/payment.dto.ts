import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsOptional, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Payment card ID',
  })
  @IsString()
  @IsUUID()
  cardId: string;

  @ApiProperty({
    example: 1000.0,
    description: 'Payment amount in RUB',
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Order ID (if payment is for an order)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  orderId?: string;

  @ApiProperty({
    example: 'Payment for order #123',
    description: 'Payment description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
