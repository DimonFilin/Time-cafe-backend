import { ActivityAction, ActivityCategory, LogSeverity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateActivityLogRequestDto {
  @IsEnum(ActivityAction)
  action: ActivityAction;

  @IsEnum(ActivityCategory)
  category: ActivityCategory;

  @IsOptional()
  @IsEnum(LogSeverity)
  severity?: LogSeverity;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
