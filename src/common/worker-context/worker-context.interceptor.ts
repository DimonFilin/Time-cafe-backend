import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { WorkerContextService } from './worker-context.service';
import type { Request } from 'express';

@Injectable()
export class WorkerContextInterceptor implements NestInterceptor {
  constructor(private readonly workerContext: WorkerContextService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    await this.workerContext.attachWorkerToRequest(req);
    return next.handle();
  }
}
