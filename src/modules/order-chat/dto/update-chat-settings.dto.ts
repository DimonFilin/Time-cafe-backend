import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChatNotificationMode, WorkerRole } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class UpdateChatSettingsDto {
  @ApiPropertyOptional({ description: 'Enable/disable chat for this order' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Notification routing mode',
    enum: ChatNotificationMode,
  })
  @IsOptional()
  @IsEnum(ChatNotificationMode)
  notificationMode?: ChatNotificationMode;

  @ApiPropertyOptional({
    description: 'Roles that should receive notifications (ROLE_BASED mode)',
    enum: WorkerRole,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(WorkerRole, { each: true })
  notificationRoles?: WorkerRole[];

  @ApiPropertyOptional({
    description:
      'Worker IDs for targeted notifications (SPECIFIC_WORKERS mode)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  notificationWorkerIds?: string[];

  @ApiPropertyOptional({ description: 'Optional chat theme override JSON' })
  @IsOptional()
  theme?: Record<string, unknown>;
}
