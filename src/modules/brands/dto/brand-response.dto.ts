import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BrandStatus } from '@prisma/client';

export class BrandResponseDto {
  @ApiProperty({ example: 'uuid', description: 'Brand ID' })
  id: string;

  @ApiProperty({ example: 'Coffee Brand Name', description: 'Brand name' })
  name: string;

  @ApiPropertyOptional({
    example: 'Brand description',
    description: 'Brand description',
  })
  description?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:9000/brands/.../logo.png',
    description: 'Logo URL',
  })
  logo?: string;

  @ApiPropertyOptional({ example: '#000000', description: 'Primary color' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#FFFFFF', description: 'Secondary color' })
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#007BFF', description: 'Accent color' })
  accentColor?: string;

  @ApiPropertyOptional({ example: '#F8F9FA', description: 'Background color' })
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '#212529', description: 'Text color' })
  textColor?: string;

  @ApiPropertyOptional({
    example: 'Inter, sans-serif',
    description: 'Font family',
  })
  fontFamily?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:9000/brands/.../favicon.ico',
    description: 'Favicon URL',
  })
  favicon?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:9000/brands/.../banner.jpg',
    description: 'Banner image URL',
  })
  bannerImage?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:9000/brands/.../background.jpg',
    description: 'Background image URL',
  })
  backgroundImage?: string;

  @ApiPropertyOptional({
    example: 'https://brand.com',
    description: 'Website URL',
  })
  website?: string;

  @ApiPropertyOptional({
    example: '+7 (999) 123-45-67',
    description: 'Contact phone',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'contact@brand.com',
    description: 'Contact email',
  })
  email?: string;

  @ApiPropertyOptional({
    example: '123 Main St, City, Country',
    description: 'Legal address',
  })
  address?: string;

  @ApiProperty({
    example: 'PENDING',
    enum: BrandStatus,
    description: 'Brand status',
  })
  status: BrandStatus;

  @ApiProperty({ example: false, description: 'Is brand verified' })
  isVerified: boolean;

  @ApiPropertyOptional({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Verification date',
  })
  verifiedAt?: Date;

  @ApiPropertyOptional({ description: 'Additional settings (JSON)' })
  settings?: Record<string, unknown>;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Last update date',
  })
  updatedAt: Date;
}
