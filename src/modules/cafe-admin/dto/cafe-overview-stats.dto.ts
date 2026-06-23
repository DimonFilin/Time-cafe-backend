import { ApiProperty } from '@nestjs/swagger';

export class CafeOverviewStatsDto {
  @ApiProperty({ example: '2026-06-21' })
  date: string;

  @ApiProperty({ example: 3 })
  activeWorkers: number;

  @ApiProperty({ example: 8 })
  totalWorkers: number;

  @ApiProperty({ example: 12 })
  tasksToday: number;

  @ApiProperty({ example: 5 })
  completedTasks: number;

  @ApiProperty({ example: 7 })
  ordersToday: number;

  @ApiProperty({ example: 245.5 })
  revenueToday: number;
}
