import { LogSeverity } from '@prisma/client';

/** Severity for failed HTTP-style outcomes inside activity logging. */
export function severityForHttpStatus(statusCode: number): LogSeverity {
  if (statusCode >= 500) return LogSeverity.CRITICAL;
  if (statusCode >= 400) return LogSeverity.WARNING;
  return LogSeverity.INFO;
}
