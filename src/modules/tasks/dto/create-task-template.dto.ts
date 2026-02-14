import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  Min,
} from 'class-validator';
import {
  TaskCategory,
  TaskPriority,
  TaskAssignmentType,
  WorkerRole,
} from '@prisma/client';

export class CreateTaskTemplateDto {
  @ApiProperty({ description: 'Task title', example: 'Проверка кофемашины' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Task description',
    example: 'Проверить температуру, давление, чистоту',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: TaskCategory, description: 'Task category' })
  @IsEnum(TaskCategory)
  category: TaskCategory;

  @ApiProperty({ enum: TaskPriority, description: 'Task priority' })
  @IsEnum(TaskPriority)
  priority: TaskPriority;

  @ApiPropertyOptional({
    description: 'Requires photo on completion',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requiresPhoto?: boolean;

  @ApiPropertyOptional({
    description: 'Requires comment on completion',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  requiresComment?: boolean;

  @ApiPropertyOptional({
    description: 'Estimated time in minutes',
    example: 10,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimatedMinutes?: number;

  @ApiProperty({ enum: TaskAssignmentType, description: 'Assignment type' })
  @IsEnum(TaskAssignmentType)
  assignmentType: TaskAssignmentType;

  @ApiPropertyOptional({
    description: 'Worker IDs (required if assignmentType is SPECIFIC_WORKERS)',
    type: [String],
    example: ['worker-id-1', 'worker-id-2'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  assignedWorkerIds?: string[];

  @ApiPropertyOptional({
    description: 'Worker roles (required if assignmentType is ROLE_BASED)',
    enum: WorkerRole,
    isArray: true,
  })
  @IsArray()
  @IsEnum(WorkerRole, { each: true })
  @IsOptional()
  assignedRoles?: WorkerRole[];

  @ApiPropertyOptional({
    description: 'Days of week (1=Mon, 7=Sun). Empty array = every day',
    type: [Number],
    example: [1, 2, 3, 4, 5],
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  daysOfWeek?: number[];
}
