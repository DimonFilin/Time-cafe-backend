import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskCategory, TaskPriority } from '@prisma/client';

export class WorkerTaskDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: TaskCategory })
  category: TaskCategory;

  @ApiProperty({ enum: TaskPriority })
  priority: TaskPriority;

  @ApiProperty()
  requiresPhoto: boolean;

  @ApiProperty()
  requiresComment: boolean;

  @ApiPropertyOptional()
  estimatedMinutes?: number;

  @ApiProperty({ description: 'Whether task is completed' })
  completed: boolean;

  @ApiPropertyOptional({ description: 'Completion timestamp' })
  completedAt?: Date;

  @ApiPropertyOptional({ description: 'Photo URL if completed with photo' })
  photoUrl?: string;

  @ApiPropertyOptional({ description: 'Comment if completed with comment' })
  comment?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes if completed' })
  durationMinutes?: number;
}

export class WorkerTasksResponseDto {
  @ApiProperty({ type: [WorkerTaskDto] })
  tasks: WorkerTaskDto[];

  @ApiProperty({ description: 'Number of completed tasks' })
  completedCount: number;

  @ApiProperty({ description: 'Total number of tasks' })
  totalCount: number;

  @ApiProperty({ description: 'Date for which tasks are shown' })
  date: string;
}
