import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SuspendBrandDto {
  @ApiPropertyOptional({
    example: 'Violation of terms of service',
    description: 'Reason for suspension',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
