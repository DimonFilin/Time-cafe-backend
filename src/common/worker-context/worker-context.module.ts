import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WorkerContextService } from './worker-context.service';
import { WorkerContextInterceptor } from './worker-context.interceptor';

@Global()
@Module({
  imports: [],
  providers: [
    WorkerContextService,
    { provide: APP_INTERCEPTOR, useClass: WorkerContextInterceptor },
  ],
  exports: [WorkerContextService],
})
export class WorkerContextModule {}
