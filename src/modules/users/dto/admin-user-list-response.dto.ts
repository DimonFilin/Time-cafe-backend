import { ApiProperty } from '@nestjs/swagger';
import { AdminUserListItemDto } from './admin-user-list-item.dto';

export class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserListItemDto] })
  items: AdminUserListItemDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
