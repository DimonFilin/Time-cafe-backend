import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard, Unprotected } from 'nest-keycloak-connect';
import { CafeAdminService } from './cafe-admin.service';
import { CafeAdminWorkersService } from './services/cafe-admin-workers.service';
import { CafeAdminCafeService } from './services/cafe-admin-cafe.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { InviteWorkerDto } from './dto/invite-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';
import { UpdateCafeScheduleDto } from './dto/update-cafe-schedule.dto';
import {
  CreateWorkerScheduleAbsenceDto,
  UpdateWorkerShiftScheduleDto,
} from './dto/worker-shift-schedule.dto';
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import {
  ActivityAction,
  ActivityCategory,
  LogSeverity,
  WorkerRole,
} from '@prisma/client';
import type { Request as ExpressRequest } from 'express';
import type { WorkerAccount } from '@prisma/client';

type CafeAdminRequestUser = {
  workerId: string;
  email?: string;
  role: string;
  brandId?: string;
  cafeId?: string;
};

type CafeAdminRequest = ExpressRequest & {
  user?: CafeAdminRequestUser;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const raw = value[key];
  return typeof raw === 'string' ? raw : undefined;
}

function getHeaderString(
  headers: ExpressRequest['headers'],
  name: string,
): string | undefined {
  const raw = headers[name.toLowerCase()];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return undefined;
}

function readCookieFromHeader(
  cookieHeader: string,
  cookieName: string,
): string | undefined {
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(`${cookieName}=`));
  if (!match) return undefined;

  const value = match.slice(cookieName.length + 1).trim();
  return value || undefined;
}

function readCookieFromParsedCookies(
  cookies: unknown,
  cookieName: string,
): string | undefined {
  if (!isRecord(cookies)) return undefined;
  const raw = cookies[cookieName];
  return typeof raw === 'string' ? raw : undefined;
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;
  return Buffer.from(padded, 'base64').toString('utf8');
}

function getKeycloakIdFromJwt(token: string): string {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new BadRequestException('Invalid authorization token format');
  }

  let payloadRaw = '';
  try {
    payloadRaw = decodeBase64Url(parts[1]);
  } catch {
    throw new BadRequestException('Invalid authorization token payload');
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(payloadRaw) as unknown;
  } catch {
    throw new BadRequestException('Invalid authorization token payload');
  }

  const sub = getStringField(payload, 'sub');
  if (!sub) {
    throw new BadRequestException('Authorization token missing subject');
  }

  return sub;
}

@ApiTags('Cafe Admin')
@Controller('cafe-admin')
@UseGuards(AuthGuard)
@Unprotected()
@ApiBearerAuth()
export class CafeAdminController {
  constructor(
    private readonly cafeAdminService: CafeAdminService,
    private readonly workersService: CafeAdminWorkersService,
    private readonly cafeService: CafeAdminCafeService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  /**
   * Helper to extract worker info from token/cookie and add to request
   */
  private async enrichRequest(req: CafeAdminRequest): Promise<{
    worker: WorkerAccount;
    cafeId: string;
  }> {
    console.log('[cafe-admin] enrichRequest: checking authentication');

    // First, try to get workerId from cookie (selected account)
    let workerId: string | undefined;
    const cookieHeader = getHeaderString(req.headers, 'cookie');
    const cookieFromParser = readCookieFromParsedCookies(
      (req as unknown as { cookies?: unknown }).cookies,
      'tc_account_id',
    );

    if (cookieFromParser) {
      workerId = cookieFromParser;
    } else if (cookieHeader) {
      workerId = readCookieFromHeader(cookieHeader, 'tc_account_id');
    }

    console.log('[cafe-admin] Extracted workerId from cookie:', workerId);

    let worker: WorkerAccount | null = null;

    if (workerId) {
      // Get worker by ID directly from cookie
      worker = await this.cafeAdminService.getWorkerById(workerId);
      console.log('[cafe-admin] Found worker by ID:', {
        id: worker?.id,
        role: worker?.role,
        cafeId: worker?.cafeId,
      });
    } else {
      // Fallback: get from JWT token
      console.log('[cafe-admin] No cookie, trying JWT token');
      const authHeader = getHeaderString(req.headers, 'authorization');
      if (!authHeader) {
        throw new BadRequestException('Authorization header missing');
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : authHeader;
      const keycloakId = getKeycloakIdFromJwt(token);

      console.log('[cafe-admin] Looking up worker by keycloakId:', keycloakId);
      worker = await this.cafeAdminService.getWorkerFromToken(keycloakId);
      console.log('[cafe-admin] Found worker by keycloakId:', {
        id: worker?.id,
        role: worker?.role,
        cafeId: worker?.cafeId,
      });
    }

    if (!worker) {
      throw new BadRequestException('Worker account not found');
    }

    // Check if worker is CAFE_ADMIN
    if (
      worker.role !== WorkerRole.CAFE_ADMIN &&
      worker.role !== WorkerRole.SYSTEM_ADMIN
    ) {
      console.log('[cafe-admin] Access denied. Role:', worker.role);
      throw new BadRequestException('Only Cafe Admin can access this resource');
    }

    const cafeId = worker.cafeId ?? undefined;
    if (!cafeId) {
      throw new BadRequestException('Cafe Admin must be assigned to a cafe');
    }

    // Add user info to request for LogActivity decorator
    req.user = {
      workerId: String(worker.id),
      email: typeof worker.email === 'string' ? worker.email : undefined,
      role: String(worker.role),
      brandId: worker.brandId || undefined,
      cafeId,
    };

    console.log('[cafe-admin] enrichRequest success. CafeId:', cafeId);
    return { worker, cafeId };
  }

  // ============================================
  // Workers Management
  // ============================================

  @Post('workers')
  @ApiOperation({ summary: 'Invite a new worker to the cafe' })
  @ApiResponse({ status: 201, description: 'Worker invited successfully' })
  @LogActivity(ActivityAction.CREATE, ActivityCategory.DATA, {
    resourceType: 'WORKER',
    getResourceId: (result: unknown) => getStringField(result, 'id'),
    getDetails: (result: unknown) => ({
      email: getStringField(result, 'email'),
      firstName: getStringField(result, 'firstName'),
      lastName: getStringField(result, 'lastName'),
    }),
  })
  async inviteWorker(
    @Request() req: CafeAdminRequest,
    @Body() dto: InviteWorkerDto,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.workersService.inviteWorker(cafeId, dto);
  }

  @Get('workers')
  @ApiOperation({ summary: 'Get list of cafe workers' })
  @ApiResponse({ status: 200, description: 'Workers list retrieved' })
  async getWorkers(
    @Request() req: CafeAdminRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('shiftStatus') shiftStatus?: 'ON_SHIFT' | 'OFF_SHIFT',
  ) {
    const { cafeId, worker } = await this.enrichRequest(req);
    const data = await this.workersService.getWorkers(cafeId, {
      page,
      limit,
      search,
      shiftStatus,
    });
    await this.activityLogsService.log({
      workerId: worker.id,
      workerEmail: worker.email,
      workerRole: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId,
      action: ActivityAction.VIEW_LIST,
      category: ActivityCategory.VIEW,
      resourceType: 'WORKER',
      details: { cafeId, page, limit, search, shiftStatus },
    });
    return data;
  }

  @Get('workers/:id')
  @ApiOperation({ summary: 'Get worker by ID' })
  @ApiResponse({ status: 200, description: 'Worker retrieved' })
  async getWorkerById(
    @Request() req: CafeAdminRequest,
    @Param('id') workerId: string,
  ) {
    const { cafeId, worker } = await this.enrichRequest(req);
    const data = await this.workersService.getWorkerById(cafeId, workerId);
    await this.activityLogsService.log({
      workerId: worker.id,
      workerEmail: worker.email,
      workerRole: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId,
      action: ActivityAction.VIEW_DETAIL,
      category: ActivityCategory.VIEW,
      resourceType: 'WORKER',
      resourceId: workerId,
      details: { cafeId },
    });
    return data;
  }

  @Get('workers/:id/shift-schedule')
  @ApiOperation({ summary: 'Get worker weekly shift template and absences' })
  async getWorkerShiftSchedule(
    @Request() req: CafeAdminRequest,
    @Param('id') workerId: string,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.workersService.getShiftSchedule(cafeId, workerId);
  }

  @Put('workers/:id/shift-schedule')
  @ApiOperation({ summary: 'Replace worker weekly shift template (7 days)' })
  async putWorkerShiftSchedule(
    @Request() req: CafeAdminRequest,
    @Param('id') workerId: string,
    @Body() dto: UpdateWorkerShiftScheduleDto,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.workersService.updateShiftSchedule(cafeId, workerId, dto);
  }

  @Get('workers/:id/schedule-absences')
  @ApiOperation({ summary: 'List vacation / sick absences for worker' })
  async listWorkerScheduleAbsences(
    @Request() req: CafeAdminRequest,
    @Param('id') workerId: string,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.workersService.listScheduleAbsences(cafeId, workerId);
  }

  @Post('workers/:id/schedule-absences')
  @ApiOperation({ summary: 'Add vacation / sick absence range' })
  async createWorkerScheduleAbsence(
    @Request() req: CafeAdminRequest,
    @Param('id') workerId: string,
    @Body() dto: CreateWorkerScheduleAbsenceDto,
  ) {
    const { cafeId, worker } = await this.enrichRequest(req);
    return this.workersService.createScheduleAbsence(
      cafeId,
      workerId,
      dto,
      String(worker.id),
    );
  }

  @Delete('workers/:id/schedule-absences/:absenceId')
  @ApiOperation({ summary: 'Remove absence range' })
  async deleteWorkerScheduleAbsence(
    @Request() req: CafeAdminRequest,
    @Param('id') workerId: string,
    @Param('absenceId') absenceId: string,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.workersService.deleteScheduleAbsence(
      cafeId,
      workerId,
      absenceId,
    );
  }

  @Patch('workers/:id')
  @ApiOperation({ summary: 'Update worker information' })
  @ApiResponse({ status: 200, description: 'Worker updated successfully' })
  @LogActivity(ActivityAction.UPDATE, ActivityCategory.DATA, {
    resourceType: 'WORKER',
    getResourceId: (result: unknown) => getStringField(result, 'id'),
    getDetails: (result: unknown) => ({
      email: getStringField(result, 'email'),
      firstName: getStringField(result, 'firstName'),
      lastName: getStringField(result, 'lastName'),
    }),
  })
  async updateWorker(
    @Request() req: CafeAdminRequest,
    @Param('id') workerId: string,
    @Body() dto: UpdateWorkerDto,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.workersService.updateWorker(cafeId, workerId, dto);
  }

  @Delete('workers/:id')
  @ApiOperation({ summary: 'Delete worker' })
  @ApiResponse({ status: 200, description: 'Worker deleted successfully' })
  @LogActivity(ActivityAction.DELETE, ActivityCategory.DATA, {
    resourceType: 'WORKER',
    getResourceId: () => undefined, // Will be logged from params
  })
  async deleteWorker(
    @Request() req: CafeAdminRequest,
    @Param('id') workerId: string,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.workersService.deleteWorker(cafeId, workerId);
  }

  // ============================================
  // Cafe Management
  // ============================================

  @Get('cafe/my')
  @ApiOperation({ summary: 'Get my cafe information' })
  @ApiResponse({ status: 200, description: 'Cafe information retrieved' })
  async getMyCafe(@Request() req: CafeAdminRequest) {
    const { cafeId } = await this.enrichRequest(req);
    return this.cafeService.getMyCafe(cafeId);
  }

  @Patch('cafe/my')
  @ApiOperation({ summary: 'Update my cafe information' })
  @ApiResponse({ status: 200, description: 'Cafe updated successfully' })
  @LogActivity(ActivityAction.UPDATE, ActivityCategory.DATA, {
    resourceType: 'CAFE',
    getResourceId: (result: unknown) => getStringField(result, 'id'),
    getDetails: (result: unknown) => ({
      name: getStringField(result, 'name'),
      address: getStringField(result, 'address'),
      city: getStringField(result, 'city'),
    }),
  })
  async updateMyCafe(
    @Request() req: CafeAdminRequest,
    @Body() dto: UpdateCafeDto,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.cafeService.updateMyCafe(cafeId, dto);
  }

  @Patch('cafe/my/schedule')
  @ApiOperation({ summary: 'Update cafe schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @LogActivity(ActivityAction.UPDATE, ActivityCategory.DATA, {
    resourceType: 'CAFE_SCHEDULE',
    getResourceId: (result: unknown) => getStringField(result, 'id'),
  })
  async updateCafeSchedule(
    @Request() req: CafeAdminRequest,
    @Body() dto: UpdateCafeScheduleDto,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.cafeService.updateCafeSchedule(cafeId, dto);
  }

  // ============================================
  // Activity Logs
  // ============================================

  @Get('activity-logs')
  @ApiOperation({ summary: 'Get activity logs for cafe' })
  @ApiResponse({ status: 200, description: 'Activity logs retrieved' })
  async getActivityLogs(
    @Request() req: CafeAdminRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('workerId') workerId?: string,
    @Query('action') action?: ActivityAction,
    @Query('category') category?: ActivityCategory,
    @Query('severity') severity?: LogSeverity,
    @Query('resourceType') resourceType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.activityLogsService.getLogs({
      cafeId: cafeId || undefined,
      page,
      limit,
      workerId,
      action,
      category,
      severity,
      resourceType,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });
  }

  @Get('activity-logs/stats')
  @ApiOperation({ summary: 'Get activity logs statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getActivityLogsStats(
    @Request() req: CafeAdminRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const { cafeId } = await this.enrichRequest(req);
    return this.activityLogsService.getStatistics({
      cafeId: cafeId || undefined,
      startDate,
      endDate,
    });
  }
}
