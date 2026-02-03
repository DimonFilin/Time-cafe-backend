import { ApiProperty } from '@nestjs/swagger';

export class RegionResponseDto {
  @ApiProperty({ example: 'region-uuid-123' })
  id: string;

  @ApiProperty({ example: 'Москва и область' })
  name: string;

  @ApiProperty({ example: 'Россия' })
  country: string;

  @ApiProperty({ example: '2025-01-07T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-07T10:00:00Z' })
  updatedAt: Date;
}
