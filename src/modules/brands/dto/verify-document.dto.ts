import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class VerifyDocumentDto {
  @ApiPropertyOptional({
    example: 'Document verified successfully',
    description: 'Optional verification note',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  verificationNote?: string;
}
