import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsString,
  ArrayMinSize,
} from 'class-validator';

export class UpdateApiKeyDto {
  @ApiPropertyOptional({
    example: 'Updated API Key Name',
    description: 'New name for the API key',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: ['brands:create', 'brands:read', 'brands:update'],
    description: 'Updated array of permissions',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({
    example: true,
    description: 'Is key active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.000Z',
    description: 'Expiration date',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
