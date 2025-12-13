import { utilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { join } from 'path';

const logDir = join(process.cwd(), 'logs');

export const loggerConfig = WinstonModule.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        utilities.format.nestLike('TimeCafe-Shared', {
          prettyPrint: true,
        }),
      ),
    }),
    new winston.transports.File({
      filename: join(logDir, 'combined.txt'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new winston.transports.File({
      filename: join(logDir, 'error.txt'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
});
