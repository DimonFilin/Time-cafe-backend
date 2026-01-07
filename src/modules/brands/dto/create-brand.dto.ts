import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Coffee Brand Name', description: 'Brand name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Brand description',
    description: 'Brand description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'contact@brand.com', description: 'Contact email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+375 (29) 123-45-67', description: 'Contact phone' })
  @IsString()
  phone: string;

  @ApiProperty({
    example: '123 Main St, City, Country',
    description: 'Legal address',
  })
  @IsString()
  address: string;

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
