import {
  Body,
  Controller,
  Delete,
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
import { PrismaService } from '../../prisma/prisma.service';
import { GuestsService } from '../guests/guests.service';
import { GuestWalletService } from './guest-wallet.service';
import { TopUpDto, TopUpPreviewDto } from './dto/top-up.dto';

@ApiTags('User Wallet')
@Controller('users/me/wallet')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class UsersWalletController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestsService: GuestsService,
    private readonly walletService: GuestWalletService,
  ) {}

  private async resolveGuest(keycloakId: string) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId },
    });
    if (!user) throw new Error('User not found');
    return this.guestsService.ensureGuestForUser(user);
  }

  @Get()
  @ApiOperation({ summary: 'My anticafe wallet' })
  async getWallet(@Request() req: { user?: { sub?: string } }) {
    const guest = await this.resolveGuest(req.user!.sub!);
    return this.walletService.getWallet(guest.id);
  }

  @Post('top-up/preview')
  async preview(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: TopUpPreviewDto,
  ) {
    const guest = await this.resolveGuest(req.user!.sub!);
    const paymentType = dto.paymentType ?? 'TOP_UP_CARD';
    return this.walletService.buildPreview(
      guest.id,
      { ...dto, paymentType, cafeId: undefined },
      'MOBILE',
    );
  }

  @Post('top-up')
  async topUp(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: TopUpDto,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: req.user!.sub! },
    });
    const guest = await this.guestsService.ensureGuestForUser(user!);
    const paymentType = dto.paymentType ?? 'TOP_UP_CARD';
    return this.walletService.topUp(
      null,
      guest.id,
      { ...dto, paymentType, cafeId: undefined },
      'MOBILE',
      { userId: user!.id },
    );
  }

  @Post('welcome-shown')
  async welcomeShown(@Request() req: { user?: { sub?: string } }) {
    const guest = await this.resolveGuest(req.user!.sub!);
    return this.guestsService.markWelcomeShown(guest.id);
  }

  @Get('notifications')
  async notifications(
    @Request() req: { user?: { sub?: string } },
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: req.user!.sub! },
    });
    return this.prisma.userNotification.findMany({
      where: {
        userId: user!.id,
        type: { not: 'PHONE_VERIFY' },
        ...(unreadOnly === 'true' ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Patch('notifications/:id/read')
  async markRead(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: req.user!.sub! },
    });
    return this.prisma.userNotification.updateMany({
      where: { id, userId: user!.id },
      data: { readAt: new Date() },
    });
  }

  @Patch('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Request() req: { user?: { sub?: string } }) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: req.user!.sub! },
    });
    await this.prisma.userNotification.updateMany({
      where: { userId: user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Delete('notifications/:id')
  @ApiOperation({ summary: 'Delete notification' })
  async deleteNotification(
    @Request() req: { user?: { sub?: string } },
    @Param('id') id: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: req.user!.sub! },
    });
    await this.prisma.userNotification.deleteMany({
      where: { id, userId: user!.id },
    });
    return { ok: true };
  }
}
