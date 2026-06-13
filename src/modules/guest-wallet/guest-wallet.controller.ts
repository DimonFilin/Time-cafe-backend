import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { GuestWalletService } from './guest-wallet.service';
import { TopUpDto, TopUpPreviewDto } from './dto/top-up.dto';

@ApiTags('Guest Wallet')
@Controller()
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class GuestWalletController {
  constructor(private readonly walletService: GuestWalletService) {}

  private sub(req: { user?: { sub?: string } }): string {
    const id = req.user?.sub;
    if (!id) throw new Error('User ID not found in token');
    return id;
  }

  @Post('admin/guests/:guestId/top-up/preview')
  @ApiOperation({ summary: 'Preview top-up with loyalty info' })
  previewAdmin(
    @Param('guestId') guestId: string,
    @Body() dto: TopUpPreviewDto,
  ) {
    const source = dto.paymentType === 'TOP_UP_MOBILE' ? 'MOBILE' : 'CAFE';
    return this.walletService.buildPreview(guestId, dto, source);
  }

  @Post('admin/guests/:guestId/top-up')
  topUpAdmin(
    @Request() req: { user?: { sub?: string } },
    @Param('guestId') guestId: string,
    @Body() dto: TopUpDto,
  ) {
    const source = dto.paymentType === 'TOP_UP_MOBILE' ? 'MOBILE' : 'CAFE';
    return this.walletService.topUp(this.sub(req), guestId, dto, source);
  }

  @Post('worker/guests/:guestId/top-up/preview')
  previewWorker(
    @Param('guestId') guestId: string,
    @Body() dto: TopUpPreviewDto,
  ) {
    return this.walletService.buildPreview(guestId, dto, 'CAFE');
  }

  @Post('worker/guests/:guestId/top-up')
  topUpWorker(
    @Request() req: { user?: { sub?: string } },
    @Param('guestId') guestId: string,
    @Body() dto: TopUpDto,
  ) {
    return this.walletService.topUp(this.sub(req), guestId, dto, 'CAFE');
  }

  @Get('admin/guests/:guestId/wallet')
  walletAdmin(@Param('guestId') guestId: string) {
    return this.walletService.getWallet(guestId);
  }

  @Get('worker/guests/:guestId/wallet')
  walletWorker(@Param('guestId') guestId: string) {
    return this.walletService.getWallet(guestId);
  }

  @Get('worker/guests/:guestId/payment-cards')
  @ApiOperation({ summary: 'Payment cards linked to guest user account' })
  guestPaymentCards(@Param('guestId') guestId: string) {
    return this.walletService.getGuestPaymentCards(guestId);
  }

  @Get('admin/guests/:guestId/ledger')
  ledgerAdmin(
    @Param('guestId') guestId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.walletService.getLedger(
      guestId,
      take ? Number(take) : 50,
      skip ? Number(skip) : 0,
    );
  }

  @Get('worker/guests/:guestId/ledger')
  @ApiOperation({ summary: 'Guest deposit ledger (staff)' })
  ledgerWorker(
    @Param('guestId') guestId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.walletService.getLedger(
      guestId,
      take ? Number(take) : 50,
      skip ? Number(skip) : 0,
    );
  }

  @Post('admin/wallet/ledger/:ledgerId/refund')
  refund(
    @Request() req: { user?: { sub?: string } },
    @Param('ledgerId') ledgerId: string,
  ) {
    return this.walletService.refundTopUp(this.sub(req), ledgerId);
  }
}
