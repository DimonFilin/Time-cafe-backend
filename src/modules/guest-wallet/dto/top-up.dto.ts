import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { WalletEntryType } from '@prisma/client';

export class TopUpDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cafeId?: string;

  @ApiProperty({ enum: ['TOP_UP_CASH', 'TOP_UP_CARD', 'TOP_UP_MOBILE'] })
  @IsEnum(WalletEntryType)
  paymentType: 'TOP_UP_CASH' | 'TOP_UP_CARD' | 'TOP_UP_MOBILE';

  @ApiPropertyOptional({
    description: 'Client payment card when TOP_UP_CARD at reception',
  })
  @IsOptional()
  @IsUUID()
  paymentCardId?: string;
}

export class TopUpPreviewDto extends TopUpDto {}
