import {
  Controller,
  ForbiddenException,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { LoyaltyService } from './loyalty.service';
import { WorkersService } from '../workers/workers.service';

@ApiTags('Staff Loyalty')
@Controller()
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class LoyaltyStaffController {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly workersService: WorkersService,
  ) {}

  private async assertStaff(req: { user?: { sub?: string } }) {
    const id = req.user?.sub;
    if (!id) throw new Error('User ID not found in token');
    const worker = await this.workersService.findByKeycloakId(id);
    if (!worker)
      throw new ForbiddenException('Требуется учётная запись сотрудника');
    return worker;
  }

  @Get('worker/loyalty/tiers')
  @ApiOperation({ summary: 'Active loyalty tiers for staff UI' })
  async listTiers(@Request() req: { user?: { sub?: string } }) {
    await this.assertStaff(req);
    return this.loyaltyService.listTiers(false);
  }
}
