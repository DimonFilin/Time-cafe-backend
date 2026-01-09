import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min } from 'class-validator';

export class TopUpBalanceDto {
  @ApiProperty({
    description: 'ID of the payment card to use',
    example: 'card_123456789',
  })
  @IsString()
  cardId: string;

  @ApiProperty({
    description: 'Amount to add to balance',
    example: 100.5,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount: number;
}
