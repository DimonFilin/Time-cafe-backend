import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { GuestStatus } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { ChangeGuestTierDto } from '../loyalty/dto/loyalty-tier.dto';
import { GuestsService } from './guests.service';
import {
  ConfirmPhoneVerifyDto,
  CreateNetworkGuestDto,
  GuestLookupQueryDto,
  RefuseGuestDto,
  UpdateNetworkGuestDto,
} from './dto/guest.dto';

@ApiTags('Guests')
@Controller()
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class GuestsController {
  constructor(
    private readonly guestsService: GuestsService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  private sub(req: { user?: { sub?: string } }): string {
    const id = req.user?.sub;
    if (!id) throw new Error('User ID not found in token');
    return id;
  }

  @Post('admin/guests')
  @ApiOperation({ summary: 'Create network guest' })
  create(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: CreateNetworkGuestDto,
  ) {
    return this.guestsService.create(this.sub(req), dto);
  }

  @Get('admin/guests')
  list(
    @Request() req: { user?: { sub?: string } },
    @Query('status') status?: GuestStatus,
  ) {
    return this.guestsService.findAll(this.sub(req), { status });
  }

  @Get('admin/guests/:id')
  getOne(@Request() req: { user?: { sub?: string } }, @Param('id') id: string) {
    return this.guestsService.findOne(this.sub(req), id);
  }

  @Patch('admin/guests/:id')
  update(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateNetworkGuestDto,
  ) {
    return this.guestsService.update(this.sub(req), id, dto);
  }

  @Post('admin/guests/:id/verify-phone/request')
  @ApiOperation({
    summary: 'Request phone verification code (in-app + reception panel)',
  })
  requestPhoneVerify(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    return this.guestsService.requestPhoneVerify(this.sub(req), id);
  }

  @Post('admin/guests/:id/verify-phone/confirm')
  @ApiOperation({ summary: 'Confirm phone verification code' })
  confirmPhoneVerify(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: ConfirmPhoneVerifyDto,
  ) {
    return this.guestsService.confirmPhoneVerify(this.sub(req), id, dto.code);
  }

  @Post('admin/guests/:id/refuse')
  refuse(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: RefuseGuestDto,
  ) {
    return this.guestsService.refuseGuest(this.sub(req), id, dto.refusedReason);
  }

  @Post('admin/guests/:id/restore')
  restore(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    return this.guestsService.restoreGuest(this.sub(req), id);
  }

  @Get('admin/guests/:id/tier-history')
  tierHistoryAdmin(@Param('id') guestId: string) {
    return this.loyaltyService.getGuestTierHistory(guestId);
  }

  @Get('worker/guests/:id/tier-history')
  tierHistoryWorker(@Param('id') guestId: string) {
    return this.loyaltyService.getGuestTierHistory(guestId);
  }

  @Patch('admin/guests/:id/tier')
  changeTierAdmin(
    @Request() req: { user?: { sub?: string } },
    @Param('id') guestId: string,
    @Body() dto: ChangeGuestTierDto,
  ) {
    return this.loyaltyService.changeGuestTier(
      this.sub(req),
      guestId,
      dto.tierId,
      dto.reason,
    );
  }

  @Patch('worker/guests/:id/tier')
  changeTierWorker(
    @Request() req: { user?: { sub?: string } },
    @Param('id') guestId: string,
    @Body() dto: ChangeGuestTierDto,
  ) {
    return this.loyaltyService.changeGuestTier(
      this.sub(req),
      guestId,
      dto.tierId,
      dto.reason,
    );
  }

  @Get('worker/guests/lookup')
  @ApiOperation({ summary: 'Find guest by phone or SCUD card' })
  lookup(
    @Request() req: { user?: { sub?: string } },
    @Query() query: GuestLookupQueryDto,
  ) {
    return this.guestsService.lookup(
      this.sub(req),
      query.phone,
      query.accessCardNumber,
      query.payload,
    );
  }
}
