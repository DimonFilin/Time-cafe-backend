import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';

@Module({
  controllers: [SystemController],
  providers: [
    SystemService,
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class SystemModule {}
