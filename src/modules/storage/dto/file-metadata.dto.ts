import { ApiProperty } from '@nestjs/swagger';

export class FileMetadataDto {
  @ApiProperty({
    description: 'Путь к файлу',
    example: 'brand-123/logo/logo.png',
  })
  path: string;

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
    description: 'Дата последнего изменения',
    example: '2024-01-01T00:00:00.000Z',
  })
  lastModified: Date;

  @ApiProperty({
    description: 'ETag для проверки целостности',
    example: '"d41d8cd98f00b204e9800998ecf8427e"',
  })
  etag: string;
}
