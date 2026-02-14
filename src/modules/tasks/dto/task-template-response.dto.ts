import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TaskCategory,
  TaskPriority,
  TaskAssignmentType,
  WorkerRole,
} from '@prisma/client';

export class TaskTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cafeId: string;

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

  @ApiProperty({ enum: TaskAssignmentType })
  assignmentType: TaskAssignmentType;

  @ApiProperty({ type: [String] })
  assignedWorkerIds: string[];

  @ApiProperty({ enum: WorkerRole, isArray: true })
  assignedRoles: WorkerRole[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: [Number] })
  daysOfWeek: number[];

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
