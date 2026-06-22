import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReceptionScanQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accessCardNumber?: string;

  @ApiPropertyOptional({ description: 'Raw SCUD QR JSON or card number' })
  @IsOptional()
  @IsString()
  payload?: string;

  @ApiPropertyOptional({
    description: 'Guest phone when card QR is unavailable',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Cafe scope (must match selected worker account)',
  })
  @IsOptional()
  @IsString()
  cafeId?: string;
}
