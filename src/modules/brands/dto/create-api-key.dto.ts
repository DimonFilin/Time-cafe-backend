import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsDateString,
  ArrayMinSize,
} from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'Production API Key',
    description: 'Name for the API key',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: ['brands:create', 'brands:read'],
    description: 'Array of permissions',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissions: string[];

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.000Z',
    description: 'Expiration date (optional)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
