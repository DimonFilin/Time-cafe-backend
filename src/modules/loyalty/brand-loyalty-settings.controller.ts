import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { WorkerRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import {
  BrandLoyaltySettings,
  mergeBrandLoyaltyIntoSettings,
  parseBrandLoyaltySettings,
} from './brand-loyalty-settings';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LoyaltyDisplayMode } from './brand-loyalty-settings';

class UpdateBrandLoyaltySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  bonusesEnabled?: boolean;

  @ApiPropertyOptional({ enum: ['NONE', 'BRIEF', 'FULL'] })
  @IsOptional()
  @IsEnum(['NONE', 'BRIEF', 'FULL'])
  displayMode?: LoyaltyDisplayMode;
}

@ApiTags('Brand Loyalty Settings')
@Controller('brands/my/loyalty')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class BrandLoyaltySettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
  ) {}

  private async brandAdminBrandId(keycloakId: string): Promise<string> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (
      !worker ||
      (worker.role !== WorkerRole.BRAND_ADMIN &&
        worker.role !== WorkerRole.SYSTEM_ADMIN)
    ) {
      throw new ForbiddenException();
    }
    if (worker.role === WorkerRole.SYSTEM_ADMIN && worker.brandId) {
      return worker.brandId;
    }
    if (!worker.brandId) throw new NotFoundException('Brand not found');
    return worker.brandId;
  }

  @Get('settings')
  @ApiOperation({ summary: 'Brand loyalty display and bonus settings' })
  async get(@Request() req: { user?: { sub?: string } }) {
    const brandId = await this.brandAdminBrandId(req.user!.sub!);
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });
    return parseBrandLoyaltySettings(brand?.settings);
  }

  @Patch('settings')
  async update(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: UpdateBrandLoyaltySettingsDto,
  ) {
    const brandId = await this.brandAdminBrandId(req.user!.sub!);
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    const current =
      brand.settings && typeof brand.settings === 'object'
        ? (brand.settings as Record<string, unknown>)
        : {};
    const next = mergeBrandLoyaltyIntoSettings(
      current,
      dto as Partial<BrandLoyaltySettings>,
    );
    await this.prisma.brand.update({
      where: { id: brandId },
      data: { settings: next as object },
    });
    return parseBrandLoyaltySettings(next);
  }
}
