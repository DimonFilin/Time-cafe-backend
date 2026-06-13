import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { LoyaltyReportsService } from './loyalty-reports.service';

@ApiTags('Loyalty Reports')
@Controller('admin/loyalty/reports')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class LoyaltyReportsController {
  constructor(private readonly reportsService: LoyaltyReportsService) {}

  private sub(req: { user?: { sub?: string } }): string {
    const id = req.user?.sub;
    if (!id) throw new Error('User ID not found in token');
    return id;
  }

  @Get('balances')
  @ApiOperation({ summary: 'Client deposit balances' })
  balances(@Request() req: { user?: { sub?: string } }) {
    return this.reportsService.balances(this.sub(req));
  }

  @Get('balances-with-bonuses')
  balancesWithBonuses(
    @Request() req: { user?: { sub?: string } },
    @Query('detail') detail?: string,
  ) {
    return this.reportsService.balancesWithBonuses(
      this.sub(req),
      detail === 'true',
    );
  }

  @Get('debtors')
  debtors(@Request() req: { user?: { sub?: string } }) {
    return this.reportsService.debtors(this.sub(req));
  }

  @Get('cash-inflows')
  cashInflows(
    @Request() req: { user?: { sub?: string } },
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('brandId') brandId?: string,
  ) {
    return this.reportsService.cashInflows(
      this.sub(req),
      new Date(from),
      new Date(to),
      brandId,
    );
  }
}
