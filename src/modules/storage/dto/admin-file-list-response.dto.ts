import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminFileListItemDto } from './admin-file-list-item.dto';

export class AdminFileListResponseDto {
  @ApiProperty({ type: [AdminFileListItemDto], description: 'List of files' })
  items: AdminFileListItemDto[];

  @ApiProperty({ example: 150, description: 'Total number of files' })
  total: number;

  @ApiProperty({ example: 'brands', description: 'Bucket name' })
  bucket: string;

  @ApiPropertyOptional({ example: 'brands/', description: 'Prefix filter' })
  prefix?: string;
}
