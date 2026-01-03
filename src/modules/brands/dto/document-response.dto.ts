import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';

export class DocumentResponseDto {
  @ApiProperty({ example: 'uuid', description: 'Document ID' })
  id: string;

  @ApiProperty({
    example: 'REGISTRATION',
    enum: DocumentType,
    description: 'Document type',
  })
  type: DocumentType;

  @ApiProperty({
    example: 'Registration Certificate',
    description: 'Document name',
  })
  name: string;

  @ApiProperty({
    example: 'http://localhost:9000/brands/.../documents/file.pdf',
    description: 'File URL',
  })
  fileUrl: string;

  @ApiPropertyOptional({
    example: 'application/pdf',
    description: 'File MIME type',
  })
  fileType?: string;

  @ApiPropertyOptional({ example: 102400, description: 'File size in bytes' })
  fileSize?: number;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Upload date',
  })
  uploadedAt: Date;

  @ApiPropertyOptional({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Verification date',
  })
  verifiedAt?: Date;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'ID of user who verified',
  })
  verifiedBy?: string;

  @ApiProperty({ example: false, description: 'Is document verified' })
  isVerified: boolean;

  @ApiPropertyOptional({
    example: 'Document verified successfully',
    description: 'Verification note',
  })
  verificationNote?: string;

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
