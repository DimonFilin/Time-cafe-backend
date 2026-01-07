import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { SystemSettingsService } from './system-settings.service';
import {
  UpdateSystemSettingsDto,
  SystemSettingsResponseDto,
} from './dto/system-settings.dto';
import { WorkersService } from '../workers/workers.service';
import { WorkerRole } from '@prisma/client';

@ApiTags('System Settings')
@Controller('admin/settings')
export class SystemSettingsController {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly workersService: WorkersService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all system settings (SYSTEM_ADMIN only)',
    description:
      'Retrieve all system settings including platform, security, moderation, notifications, integrations, and limits',
  })
  @ApiResponse({
    status: 200,
    description: 'System settings retrieved successfully',
    type: SystemSettingsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  async findAll(
    @Request() req: { user?: { sub?: string } },
  ): Promise<SystemSettingsResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Only SYSTEM_ADMIN can access system settings',
      );
    }

    return this.systemSettingsService.findAll();
  }

  @Get(':section')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get specific system settings section (SYSTEM_ADMIN only)',
    description:
      'Retrieve a specific section of system settings (platform, security, moderation, notifications, integrations, limits)',
  })
  @ApiResponse({
    status: 200,
    description: 'System settings section retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Setting section not found' })
  async findOne(
    @Param('section') section: string,
    @Request() req: { user?: { sub?: string } },
  ) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Only SYSTEM_ADMIN can access system settings',
      );
    }

    return this.systemSettingsService.findOne(section);
  }

  @Patch()
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update system settings (SYSTEM_ADMIN only)',
    description:
      'Update system settings. Only specified sections will be updated (partial update).',
  })
  @ApiResponse({
    status: 200,
    description: 'System settings updated successfully',
    type: SystemSettingsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  async update(
    @Body() updateDto: UpdateSystemSettingsDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<SystemSettingsResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException(
        'Only SYSTEM_ADMIN can update system settings',
      );
    }

    return this.systemSettingsService.update(updateDto, worker.id);
  }
}
