import { ApiProperty } from '@nestjs/swagger';

export class FileUploadResultDto {
  @ApiProperty({
    description: 'Публичный URL файла',
    example: 'http://localhost:9000/brands/brand-123/logo/logo.png',
  })
  url: string;

  @ApiProperty({
    description: 'Путь к файлу в bucket',
    example: 'brand-123/logo/logo.png',
  })
  path: string;

  @ApiProperty({
    description: 'Имя bucket',
    example: 'brands',
  })
  bucket: string;

  @ApiProperty({
    description: 'Размер файла в байтах',
    example: 102400,
  })
  size: number;

  @ApiProperty({
    description: 'MIME тип файла',
    example: 'image/png',
  })
  mimeType: string;

  @ApiProperty({
    description: 'ETag для проверки целостности',
    example: '"d41d8cd98f00b204e9800998ecf8427e"',
  })
  etag: string;

  @ApiProperty({
    description: 'Дата загрузки',
    example: '2024-01-01T00:00:00.000Z',
  })
  uploadedAt: Date;
}
