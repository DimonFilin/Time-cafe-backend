import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ForbiddenException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Unprotected } from 'nest-keycloak-connect';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  CompleteTaskDto,
  TaskTemplateResponseDto,
  WorkerTasksResponseDto,
  TaskStatisticsResponseDto,
  TaskCompletionHistoryResponseDto,
} from './dto';

interface RequestWithAuth {
  user?: {
    sub?: string;
    id?: string;
  };
  cookies?: {
    tc_account_id?: string;
  };
  headers?: {
    cookie?: string;
  };
}

@ApiTags('Tasks')
@Controller()
@Unprotected()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // Helper method to get worker from token
  private async getWorkerFromToken(
    req: RequestWithAuth,
    requiredRole?: 'CAFE_ADMIN' | 'SYSTEM_ADMIN',
  ) {
    console.log('DEBUG getWorkerFromToken: req.user =', req?.user);
    console.log('DEBUG: req.cookies =', req?.cookies);
    console.log('DEBUG: req.headers.cookie =', req?.headers?.cookie);

    // First, try to get workerId from cookie (selected account)
    // Parse cookie manually since @Unprotected() doesn't populate req.cookies
    let workerId: string | undefined;

    const cookieHeader = req?.headers?.cookie ?? req?.cookies?.tc_account_id;
    if (cookieHeader) {
      if (typeof cookieHeader === 'string' && cookieHeader.includes('=')) {
        // Parse cookie string
        const cookies = cookieHeader.split(';').map((c) => c.trim());
        const accountCookie = cookies.find((c) =>
          c.startsWith('tc_account_id='),
        );
        if (accountCookie) {
          const parts = accountCookie.split('=');
          workerId = parts[1];
        }
      } else if (typeof cookieHeader === 'string') {
        // Already parsed (from req.cookies)
        workerId = cookieHeader;
      }
    }

    console.log('DEBUG: Extracted workerId from cookie:', workerId);

    if (workerId) {
      console.log('DEBUG: Got workerId from cookie:', workerId);

      // Get worker by ID directly
      const worker = await this.tasksService.getWorkerById(workerId);

      if (!worker) {
        console.log('DEBUG: Worker not found by ID:', workerId);
        throw new ForbiddenException('Worker account not found');
      }

      console.log('DEBUG: Found worker by ID:', {
        id: worker.id,
        role: worker.role,
        cafeId: worker.cafeId,
      });

      if (!worker.cafeId) {
        console.log('DEBUG: Worker has no cafeId');
        throw new ForbiddenException('Worker is not assigned to a cafe');
      }

      // Check role if required (only for cafe-admin endpoints)
      if (requiredRole) {
        console.log(
          'DEBUG: Checking role. Required:',
          requiredRole,
          'Actual:',
          worker.role,
        );
        if (worker.role !== requiredRole && worker.role !== 'SYSTEM_ADMIN') {
          console.log('DEBUG: Role check failed');
          throw new ForbiddenException(
            `This endpoint requires ${requiredRole} role`,
          );
        }
      }

      console.log(
        'DEBUG: getWorkerFromToken success (from cookie), returning worker',
      );
      return worker;
    }

    // Fallback: try to get from JWT token (for cases without cookie)
    console.log('DEBUG: No workerId in cookie, trying JWT token');
    let keycloakId: string | undefined;

    if (req?.user?.sub) {
      keycloakId = req.user.sub;
      console.log('DEBUG: Got keycloakId from req.user.sub:', keycloakId);
    } else {
      // Extract token from Authorization header
      const authHeader = req?.headers?.['authorization'] as string | undefined;
      console.log(
        'DEBUG: Authorization header:',
        authHeader ? 'present' : 'missing',
      );

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          // Decode JWT token (without verification for now)
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(
              Buffer.from(parts[1], 'base64').toString(),
            ) as { sub?: string };
            keycloakId = payload.sub;
            console.log('DEBUG: Got keycloakId from token:', keycloakId);
          }
        } catch (error) {
          console.log('DEBUG: Failed to decode token:', error);
        }
      }
    }

    if (!keycloakId) {
      console.log('DEBUG: No keycloakId found, throwing ForbiddenException');
      throw new ForbiddenException('User not authenticated');
    }

    console.log('DEBUG: Looking up worker by keycloakId:', keycloakId);
    const worker = await this.tasksService.getWorkerByKeycloakId(keycloakId);

    if (!worker) {
      console.log('DEBUG: Worker not found for keycloakId:', keycloakId);
      throw new ForbiddenException('Worker account not found');
    }

    console.log('DEBUG: Found worker:', {
      id: worker.id,
      role: worker.role,
      cafeId: worker.cafeId,
    });

    if (!worker.cafeId) {
      console.log('DEBUG: Worker has no cafeId');
      throw new ForbiddenException('Worker is not assigned to a cafe');
    }

    // Check role if required (only for cafe-admin endpoints)
    if (requiredRole) {
      console.log(
        'DEBUG: Checking role. Required:',
        requiredRole,
        'Actual:',
        worker.role,
      );
      if (worker.role !== requiredRole && worker.role !== 'SYSTEM_ADMIN') {
        console.log('DEBUG: Role check failed');
        throw new ForbiddenException(
          `This endpoint requires ${requiredRole} role`,
        );
      }
    }

    console.log(
      'DEBUG: getWorkerFromToken success (from JWT), returning worker',
    );
    return worker;
  }

  // ============================================
  // Cafe Admin Endpoints
  // ============================================

  @Post('cafe-admin/tasks/templates')
  @ApiOperation({ summary: 'Create task template' })
  @ApiResponse({ status: 201, type: TaskTemplateResponseDto })
  async createTemplate(
    @Body() dto: CreateTaskTemplateDto,
    @Req() req: RequestWithAuth,
  ): Promise<TaskTemplateResponseDto> {
    console.log('[createTemplate] Received DTO:', JSON.stringify(dto, null, 2));
    console.log('[createTemplate] DTO type:', typeof dto);
    console.log('[createTemplate] DTO keys:', Object.keys(dto));
    const worker = await this.getWorkerFromToken(req, 'CAFE_ADMIN');
    return this.tasksService.createTemplate(worker.cafeId!, worker.id, dto);
  }

  @Get('cafe-admin/tasks/templates')
  @ApiOperation({ summary: 'Get all task templates for cafe' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: [TaskTemplateResponseDto] })
  async getTemplates(
    @Req() req: RequestWithAuth,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<TaskTemplateResponseDto[]> {
    const worker = await this.getWorkerFromToken(req, 'CAFE_ADMIN');
    return this.tasksService.getTemplates(
      worker.cafeId!,
      includeInactive === 'true',
      worker.id,
    );
  }

  @Patch('cafe-admin/tasks/templates/:id')
  @ApiOperation({ summary: 'Update task template' })
  @ApiResponse({ status: 200, type: TaskTemplateResponseDto })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTaskTemplateDto,
    @Req() req: RequestWithAuth,
  ): Promise<TaskTemplateResponseDto> {
    const worker = await this.getWorkerFromToken(req, 'CAFE_ADMIN');
    return this.tasksService.updateTemplate(id, worker.cafeId!, worker.id, dto);
  }

  @Patch('cafe-admin/tasks/templates/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate task template' })
  @ApiResponse({ status: 200, type: TaskTemplateResponseDto })
  async deactivateTemplate(
    @Param('id') id: string,
    @Req() req: RequestWithAuth,
  ): Promise<TaskTemplateResponseDto> {
    const worker = await this.getWorkerFromToken(req, 'CAFE_ADMIN');
    return this.tasksService.deactivateTemplate(id, worker.cafeId!, worker.id);
  }

  @Get('cafe-admin/tasks/statistics')
  @ApiOperation({ summary: 'Get task completion statistics' })
  @ApiQuery({ name: 'fromDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'toDate', required: true, example: '2024-01-31' })
  @ApiResponse({ status: 200, type: TaskStatisticsResponseDto })
  async getStatistics(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Req() req: RequestWithAuth,
  ): Promise<TaskStatisticsResponseDto> {
    const worker = await this.getWorkerFromToken(req, 'CAFE_ADMIN');
    return this.tasksService.getStatistics(
      worker.cafeId!,
      fromDate,
      toDate,
      worker.id,
    );
  }

  @Get('cafe-admin/tasks/templates/:id/completions')
  @ApiOperation({ summary: 'Get completion history for task template' })
  @ApiQuery({ name: 'fromDate', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'toDate', required: true, example: '2024-01-31' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 100 })
  @ApiResponse({ status: 200, type: TaskCompletionHistoryResponseDto })
  async getTemplateCompletions(
    @Param('id') id: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(100), ParseIntPipe)
    pageSize: number,
    @Req() req: RequestWithAuth,
  ): Promise<TaskCompletionHistoryResponseDto> {
    const worker = await this.getWorkerFromToken(req, 'CAFE_ADMIN');
    return this.tasksService.getTemplateCompletions(
      id,
      worker.cafeId!,
      fromDate,
      toDate,
      page,
      pageSize,
      worker.id,
    );
  }

  // ============================================
  // Worker Endpoints
  // ============================================

  @Get('cafe-worker/tasks')
  @ApiOperation({ summary: 'Get tasks for worker on specific date' })
  @ApiQuery({
    name: 'date',
    required: false,
    example: '2024-01-15',
    description: 'Date in YYYY-MM-DD format. Defaults to today.',
  })
  @ApiResponse({ status: 200, type: WorkerTasksResponseDto })
  async getWorkerTasks(
    @Req() req: RequestWithAuth,
    @Query('date') date?: string,
  ): Promise<WorkerTasksResponseDto> {
    const worker = await this.getWorkerFromToken(req);
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.tasksService.getWorkerTasks(
      worker.id,
      worker.cafeId!,
      targetDate,
    );
  }

  @Post('cafe-worker/tasks/:templateId/complete')
  @ApiOperation({ summary: 'Mark task as completed' })
  @ApiResponse({ status: 201 })
  async completeTask(
    @Param('templateId') templateId: string,
    @Body() dto: CompleteTaskDto,
    @Req() req: RequestWithAuth,
  ) {
    const worker = await this.getWorkerFromToken(req);
    return this.tasksService.completeTask(templateId, worker.id, dto);
  }

  @Delete('cafe-worker/tasks/:templateId/complete')
  @ApiOperation({ summary: 'Unmark task completion' })
  @ApiQuery({ name: 'date', required: true, example: '2024-01-15' })
  @ApiResponse({ status: 200 })
  async uncompleteTask(
    @Param('templateId') templateId: string,
    @Query('date') date: string,
    @Req() req: RequestWithAuth,
  ) {
    const worker = await this.getWorkerFromToken(req);
    await this.tasksService.uncompleteTask(templateId, worker.id, date);
    return { success: true };
  }
}
