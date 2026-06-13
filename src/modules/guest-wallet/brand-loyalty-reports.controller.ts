import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { LoyaltyReportsService } from './loyalty-reports.service';

@ApiTags('Brand Loyalty Reports')
@Controller('brands/my/loyalty/reports')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BrandLoyaltyReportsController {
  constructor(private readonly reportsService: LoyaltyReportsService) {}

  private sub(req: { user?: { sub?: string } }): string {
    const id = req.user?.sub;
    if (!id) throw new Error('User ID not found in token');
    return id;
  }

  @Get('cash-inflows')
  @ApiOperation({ summary: 'Cash inflows in brand cafes' })
  cashInflows(
    @Request() req: { user?: { sub?: string } },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.cashInflows(
      this.sub(req),
      new Date(from),
      new Date(to),
    );
  }
}
