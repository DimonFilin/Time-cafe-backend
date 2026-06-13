import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePlatformLoyaltySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Hours until bonus accrual (default 120 = 5 days)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  accrualDelayHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minTopUpForBonus?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  tierPercentChangeCooldownHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}
