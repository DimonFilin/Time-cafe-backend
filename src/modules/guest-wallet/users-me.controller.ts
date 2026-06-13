import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { PrismaService } from '../../prisma/prisma.service';
import { GuestsService } from '../guests/guests.service';

@ApiTags('User SCUD')
@Controller('users/me')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class UsersMeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guestsService: GuestsService,
  ) {}

  @Patch('push-token')
  @ApiOperation({
    summary: 'Register Expo push token for device notifications',
  })
  async setPushToken(
    @Request() req: { user?: { sub?: string } },
    @Body() body: { pushToken?: string | null },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: req.user!.sub! },
    });
    if (!user) throw new Error('User not found');
    const token = body.pushToken?.trim() || null;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { pushToken: token },
    });
    return { ok: true };
  }

  @Get('scud-card')
  @ApiOperation({ summary: 'My SCUD card for profile QR' })
  async getScudCard(@Request() req: { user?: { sub?: string } }) {
    const user = await this.prisma.user.findFirst({
      where: { keycloakId: req.user!.sub! },
    });
    if (!user) throw new Error('User not found');
    return this.guestsService.getScudCardForUser(user.id);
  }
}
