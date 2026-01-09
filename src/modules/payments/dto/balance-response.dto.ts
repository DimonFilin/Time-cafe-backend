import { ApiProperty } from '@nestjs/swagger';

export class BalanceResponseDto {
  @ApiProperty({
    description: 'Current user balance',
    example: '150.50',
  })
  balance: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'BYN',
  })
  currency: string;
}
