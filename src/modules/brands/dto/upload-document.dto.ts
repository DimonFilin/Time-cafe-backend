import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({
    example: 'REGISTRATION',
    enum: DocumentType,
    description: 'Document type',
  })
  @IsEnum(DocumentType)
  @IsNotEmpty()
  type: DocumentType;

  @ApiProperty({
    example: 'Registration Certificate',
    description: 'Document name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
