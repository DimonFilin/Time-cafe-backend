import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RejectBrandDto {
  @ApiPropertyOptional({
    example: 'Documents do not match requirements',
    description: 'Reason for rejection',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
