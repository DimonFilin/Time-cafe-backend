import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateBrandDto {
  @ApiPropertyOptional({
    example: 'Coffee Brand Name',
    description: 'Brand name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Brand description',
    description: 'Brand description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 'contact@brand.com',
    description: 'Contact email',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+7 (999) 123-45-67',
    description: 'Contact phone',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: '123 Main St, City, Country',
    description: 'Legal address',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'https://brand.com',
    description: 'Website URL',
  })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'Additional settings (JSON)' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
