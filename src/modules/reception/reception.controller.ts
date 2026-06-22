import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import type { Request } from 'express';
import type { WorkerRequestUser } from '../../common/worker-context/worker-context.service';
import { ReceptionService } from './reception.service';
import { ReceptionScanQueryDto } from './dto/reception-scan.dto';

@ApiTags('Reception')
@Controller('worker/reception')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ReceptionController {
  constructor(private readonly receptionService: ReceptionService) {}

  private staffCtx(
    req: Request & { user?: WorkerRequestUser },
    fallbackCafeId?: string,
  ) {
    const sub = req.user?.sub;
    if (!sub) throw new Error('User ID not found in token');
    return {
      keycloakId: sub,
      workerId: req.user?.workerId,
      cafeId: req.user?.cafeId,
      fallbackCafeId,
    };
  }

  @Get('scan')
  @ApiOperation({
    summary: 'Scan SCUD card and load guest with today appointments',
  })
  scan(
    @Req() req: Request & { user?: WorkerRequestUser },
    @Query() query: ReceptionScanQueryDto,
  ) {
    return this.receptionService.scan(
      this.staffCtx(req, query.cafeId),
      query.accessCardNumber,
      query.payload,
      query.phone,
    );
  }

  @Get('guests/:guestId/appointments/today')
  @ApiOperation({ summary: 'Today appointments for guest at worker cafe' })
  guestToday(
    @Req() req: Request & { user?: WorkerRequestUser },
    @Param('guestId') guestId: string,
  ) {
    return this.receptionService.guestAppointmentsToday(
      this.staffCtx(req),
      guestId,
    );
  }
}
