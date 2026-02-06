import { ActivityAction, ActivityCategory, LogSeverity } from '@prisma/client';

interface RequestUser {
  workerId?: string;
  email?: string;
  role?: string;
  brandId?: string;
  cafeId?: string;
}

interface RequestWithUser {
  user?: RequestUser;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  url?: string;
  method?: string;
}

interface ControllerWithActivityLogs {
  activityLogsService?: {
    log: (data: Record<string, unknown>) => Promise<void>;
  };
}

export interface LogActivityOptions {
  resourceType?: string;
  getResourceId?: (result: unknown) => string | undefined;
  getDetails?: (result: unknown) => Record<string, unknown>;
  severity?: LogSeverity;
}

export function LogActivity(
  action: ActivityAction,
  category: ActivityCategory,
  options?: LogActivityOptions,
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

    descriptor.value = async function (
      this: ControllerWithActivityLogs,
      ...args: unknown[]
    ): Promise<unknown> {
      const startTime = Date.now();

      const request = args.find(
        (arg): arg is RequestWithUser =>
          typeof arg === 'object' && arg !== null && 'user' in arg,
      );

      try {
        const result: unknown = await originalMethod.apply(this, args);

        if (this.activityLogsService && request?.user) {
          const duration = Date.now() - startTime;

          const workerId = request.user.workerId;
          const workerEmail = request.user.email || 'unknown';
          const workerRole = request.user.role || 'WORKER';

          if (!workerId) {
            return result;
          }

          await this.activityLogsService.log({
            workerId,
            workerEmail,
            workerRole,
            brandId: request.user.brandId,
            cafeId: request.user.cafeId,
            action,
            category,
            severity: options?.severity || LogSeverity.INFO,
            resourceType: options?.resourceType,
            resourceId: options?.getResourceId?.(result),
            details: options?.getDetails?.(result),
            ipAddress: request.ip,
            userAgent:
              typeof request.headers?.['user-agent'] === 'string'
                ? request.headers['user-agent']
                : undefined,
            endpoint: request.url,
            method: request.method,
            statusCode: 200,
            duration,
          });
        }

        return result;
      } catch (error: unknown) {
        if (this.activityLogsService && request?.user) {
          const duration = Date.now() - startTime;

          const workerId = request.user.workerId;
          const workerEmail = request.user.email || 'unknown';
          const workerRole = request.user.role || 'WORKER';

          if (workerId) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            const errorStatus =
              typeof error === 'object' &&
              error !== null &&
              'status' in error &&
              typeof error.status === 'number'
                ? error.status
                : 500;

            await this.activityLogsService.log({
              workerId,
              workerEmail,
              workerRole,
              brandId: request.user.brandId,
              cafeId: request.user.cafeId,
              action,
              category,
              severity: LogSeverity.WARNING,
              resourceType: options?.resourceType,
              details: {
                error: errorMessage,
                stack: errorStack,
              },
              ipAddress: request.ip,
              userAgent:
                typeof request.headers?.['user-agent'] === 'string'
                  ? request.headers['user-agent']
                  : undefined,
              endpoint: request.url,
              method: request.method,
              statusCode: errorStatus,
              duration,
            });
          }
        }

        throw error;
      }
    };

    return descriptor;
  };
}
