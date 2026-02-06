import {
  ActivityAction,
  ActivityCategory,
  LogSeverity,
  WorkerRole,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

export class CreateActivityLogDto {
  workerId: string;
  workerEmail: string;
  workerRole: WorkerRole;

  brandId?: string;
  cafeId?: string;

  action: ActivityAction;
  category: ActivityCategory;
  severity?: LogSeverity;

  resourceType?: string;
  resourceId?: string;

  details?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;

  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
}
