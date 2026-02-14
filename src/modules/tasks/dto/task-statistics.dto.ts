import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TaskCompletionStatsDto {
  @ApiProperty()
  templateId: string;

  @ApiProperty()
  templateTitle: string;

  @ApiProperty()
  totalCompletions: number;

  @ApiPropertyOptional()
  averageDurationMinutes?: number;

  @ApiProperty()
  completionRate: number; // Percentage
}

export class WorkerStatsDto {
  @ApiProperty()
  workerId: string;

  @ApiProperty()
  workerName: string;

  @ApiProperty()
  totalCompletions: number;

  @ApiPropertyOptional()
  averageDurationMinutes?: number;
}

export class TaskStatisticsResponseDto {
  @ApiProperty()
  fromDate: string;

  @ApiProperty()
  toDate: string;

  @ApiProperty()
  totalCompletions: number;

  @ApiProperty()
  totalTemplates: number;

  @ApiProperty({ type: [TaskCompletionStatsDto] })
  taskStats: TaskCompletionStatsDto[];

  @ApiProperty({ type: [WorkerStatsDto] })
  workerStats: WorkerStatsDto[];
}

export class TaskCompletionHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workerId: string;

  @ApiProperty()
  workerName: string;

  @ApiProperty()
  completedAt: Date;

  @ApiProperty()
  completionDate: Date;

  @ApiPropertyOptional()
  photoUrl?: string;

  @ApiPropertyOptional()
  comment?: string;

  @ApiPropertyOptional()
  durationMinutes?: number;
}

export class TaskCompletionHistoryResponseDto {
  @ApiProperty({ type: [TaskCompletionHistoryDto] })
  completions: TaskCompletionHistoryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
