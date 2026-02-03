import { ApiProperty } from '@nestjs/swagger';
import { RegionResponseDto } from './region-response.dto';

export class RegionListResponseDto {
  @ApiProperty({ type: [RegionResponseDto] })
  items: RegionResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
