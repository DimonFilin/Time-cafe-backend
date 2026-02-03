import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminFileListItemDto {
  @ApiProperty({
    example: 'brands/brand-id/documents/file.pdf',
    description: 'File path',
  })
  path: string;

  @ApiProperty({ example: 'brands', description: 'Bucket name' })
  bucket: string;

  @ApiProperty({ example: 102400, description: 'File size in bytes' })
  size: number;

  @ApiProperty({ example: 'application/pdf', description: 'File MIME type' })
  mimeType: string;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Last modified date',
  })
  lastModified: Date;

  @ApiPropertyOptional({
    example: 'brand',
    description: 'Entity type this file belongs to (brand, cafe, user, etc.)',
  })
  entityType?: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'ID of the entity this file belongs to',
  })
  entityId?: string;

  @ApiPropertyOptional({
    example: 'documents',
    description: 'File category (documents, logo, banner, photos, etc.)',
  })
  category?: string;

  @ApiPropertyOptional({
    example: 'Brand Document',
    description: 'Human-readable description of the file relationship',
  })
  relationship?: string;
}
