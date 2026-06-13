import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { LoyaltyService } from './loyalty.service';
import { UpdatePlatformLoyaltySettingsDto } from './dto/update-platform-settings.dto';
import {
  ChangeGuestTierDto,
  CreateLoyaltyTierDto,
  DeactivateLoyaltyTierDto,
  ReorderLoyaltyTiersDto,
  UpdateLoyaltyTierDto,
} from './dto/loyalty-tier.dto';

@ApiTags('Admin Loyalty')
@Controller('admin/loyalty')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  private sub(req: { user?: { sub?: string } }): string {
    const id = req.user?.sub;
    if (!id) throw new Error('User ID not found in token');
    return id;
  }

  @Get('settings')
  @ApiOperation({ summary: 'Platform loyalty settings' })
  getSettings() {
    return this.loyaltyService.getPlatformSettings();
  }

  @Patch('settings')
  updateSettings(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: UpdatePlatformLoyaltySettingsDto,
  ) {
    return this.loyaltyService.updatePlatformSettings(this.sub(req), dto);
  }

  @Get('tiers')
  listTiers() {
    return this.loyaltyService.listTiers(true);
  }

  @Post('tiers')
  createTier(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: CreateLoyaltyTierDto,
  ) {
    return this.loyaltyService.createTier(this.sub(req), dto);
  }

  @Patch('tiers/:id')
  updateTier(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateLoyaltyTierDto,
  ) {
    return this.loyaltyService.updateTier(this.sub(req), id, dto);
  }

  @Put('tiers/reorder')
  reorder(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: ReorderLoyaltyTiersDto,
  ) {
    return this.loyaltyService.reorderTiers(this.sub(req), dto.orderedIds);
  }

  @Post('tiers/:id/deactivate')
  deactivate(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
    @Body() dto: DeactivateLoyaltyTierDto,
  ) {
    return this.loyaltyService.deactivateTier(this.sub(req), id, dto);
  }

  @Patch('guests/:guestId/tier')
  changeGuestTier(
    @Request() req: { user?: { sub?: string } },
    @Param('guestId') guestId: string,
    @Body() dto: ChangeGuestTierDto,
  ) {
    return this.loyaltyService.changeGuestTier(
      this.sub(req),
      guestId,
      dto.tierId,
      dto.reason,
    );
  }

  @Get('guests/:guestId/tier-history')
  tierHistory(@Param('guestId') guestId: string) {
    return this.loyaltyService.getGuestTierHistory(guestId);
  }
}
