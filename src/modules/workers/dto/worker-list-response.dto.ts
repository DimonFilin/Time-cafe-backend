import { ApiProperty } from '@nestjs/swagger';
import { WorkerProfileDto } from './worker-profile.dto';

export class WorkerListResponseDto {
  @ApiProperty({
    type: [WorkerProfileDto],
    description: 'List of workers',
  })
  items: WorkerProfileDto[];

  @ApiProperty({ example: 100, description: 'Total number of workers' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  totalPages: number;
}
