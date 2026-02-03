import { ApiProperty } from '@nestjs/swagger';

export class AdminUploadFileDto {
  @ApiProperty({ example: 'brands', description: 'Bucket name' })
  bucket: string;

  @ApiProperty({ example: 'test/file.pdf', description: 'File path in bucket' })
  path: string;
}
