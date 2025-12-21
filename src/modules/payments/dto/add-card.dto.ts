import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  Max,
  Length,
  Matches,
  IsOptional,
} from 'class-validator';

export class AddCardDto {
  @ApiProperty({
    example: '4242424242424242',
    description: 'Card number (16 digits)',
  })
  @IsString()
  @Length(16, 16, { message: 'Card number must be exactly 16 digits' })
  @Matches(/^\d+$/, { message: 'Card number must contain only digits' })
  cardNumber: string;

  @ApiProperty({
    example: '12',
    description: 'Expiry month (1-12)',
    minimum: 1,
    maximum: 12,
  })
  @IsNumber()
  @Min(1, { message: 'Expiry month must be between 1 and 12' })
  @Max(12, { message: 'Expiry month must be between 1 and 12' })
  expiryMonth: number;

  @ApiProperty({
    example: '2025',
    description: 'Expiry year (4 digits)',
  })
  @IsNumber()
  @Min(2024, { message: 'Expiry year must be current or future year' })
  expiryYear: number;

  @ApiProperty({
    example: '123',
    description: 'CVV code (3 digits)',
  })
  @IsString()
  @Length(3, 3, { message: 'CVV must be exactly 3 digits' })
  @Matches(/^\d+$/, { message: 'CVV must contain only digits' })
  cvv: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Card holder name',
    required: false,
  })
  @IsOptional()
  @IsString()
  holderName?: string;
}
