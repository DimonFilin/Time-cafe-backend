import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Request,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from 'nest-keycloak-connect';
import { WorkerRole, WorkerAccount } from '@prisma/client';
import { WorkersService } from './workers.service';
import { KeycloakService } from '../auth/services/keycloak.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { WorkerProfileDto } from './dto/worker-profile.dto';
import { WorkerListResponseDto } from './dto/worker-list-response.dto';
import { WorkerListQueryDto } from './dto/worker-list-query.dto';

@ApiTags('Workers')
@Controller('auth/workers')
export class WorkersController {
  constructor(
    private readonly workersService: WorkersService,
    private readonly keycloakService: KeycloakService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new worker',
    description:
      'Creates a new worker account. Requires SYSTEM_ADMIN or BRAND_ADMIN role. For CAFE_ADMIN, validates cafe exists and belongs to brand.',
  })
  @ApiResponse({
    status: 201,
    description: 'Worker successfully registered',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN or BRAND_ADMIN role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Cafe or brand not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Worker with this email already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async register(
    @Body() dto: RegisterWorkerDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AuthResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.workersService.register(keycloakId, dto);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current worker profile',
    description: 'Returns the profile of the currently authenticated worker',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker profile retrieved successfully',
    type: WorkerProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker account not found',
  })
  async getProfile(
    @Request()
    req: {
      user?: { sub?: string };
      cookies?: { tc_account_id?: string };
      headers?: { cookie?: string };
    },
  ): Promise<WorkerProfileDto> {
    const keycloakId = req.user?.sub;

    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Get selected accountId from cookie (if exists)
    const selectedAccountId =
      req.cookies?.tc_account_id ??
      req.headers?.cookie
        ?.split(';')
        .map((p) => p.trim())
        .find((p) => p.startsWith('tc_account_id='))
        ?.split('=')[1];

    let worker: WorkerAccount | null = null;

    // If accountId is provided, try to find that specific worker
    if (selectedAccountId) {
      worker = await this.workersService.findById(selectedAccountId);

      // Verify the worker belongs to this keycloakId
      if (worker && worker.keycloakId !== keycloakId) {
        worker = null;
      }
    }

    // Fallback to first worker account if no specific account selected
    if (!worker) {
      worker = await this.workersService.findByKeycloakId(keycloakId);
    }

    if (!worker) {
      throw new NotFoundException('Worker account not found');
    }

    return {
      id: worker.id,
      email: worker.email,
      firstName: worker.firstName,
      lastName: worker.lastName,
      role: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId: worker.cafeId ?? undefined,
      createdAt: worker.createdAt,
    };
  }

  @Patch('me')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update current worker profile',
    description: 'Updates the profile of the currently authenticated worker',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker profile updated successfully',
    type: WorkerProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker account not found',
  })
  async updateProfile(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: UpdateWorkerDto,
  ): Promise<WorkerProfileDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new NotFoundException('Worker account not found');
    }

    const updated = await this.workersService.update(worker.id, dto);

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      brandId: updated.brandId ?? undefined,
      cafeId: updated.cafeId ?? undefined,
      createdAt: updated.createdAt,
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update worker by ID',
    description:
      'Updates worker details. SYSTEM_ADMIN can update any worker, BRAND_ADMIN can update workers in their brand',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker updated successfully',
    type: WorkerProfileDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async updateWorkerById(
    @Param('id') id: string,
    @Body() dto: UpdateWorkerDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<WorkerProfileDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const requester = await this.workersService.findByKeycloakId(keycloakId);
    if (!requester) {
      throw new UnauthorizedException('User not found');
    }

    // Get target worker
    const targetWorker = await this.workersService.findById(id);
    if (!targetWorker) {
      throw new NotFoundException('Worker not found');
    }

    // Check permissions
    if (requester.role === WorkerRole.SYSTEM_ADMIN) {
      // SYSTEM_ADMIN can update any worker
    } else if (requester.role === WorkerRole.BRAND_ADMIN) {
      // BRAND_ADMIN can only update workers in their brand
      if (targetWorker.brandId !== requester.brandId) {
        throw new BadRequestException('Can only update workers in your brand');
      }
    } else {
      throw new BadRequestException(
        'Only SYSTEM_ADMIN and BRAND_ADMIN can update workers',
      );
    }

    const updated = await this.workersService.update(id, dto);

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      brandId: updated.brandId ?? undefined,
      cafeId: updated.cafeId ?? undefined,
      createdAt: updated.createdAt,
    };
  }

  @Delete('me')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete current worker account',
    description:
      'Soft deletes the worker account (deletes from Keycloak, marks as deleted in database)',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker account deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker account not found',
  })
  async deleteAccount(
    @Request() req: { user?: { sub?: string } },
  ): Promise<{ message: string }> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new NotFoundException('Worker account not found');
    }

    await this.keycloakService.deleteUser(keycloakId);
    await this.workersService.softDelete(worker.id);

    return { message: 'Worker account deleted successfully' };
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete worker by ID',
    description:
      'Soft deletes worker account. SYSTEM_ADMIN can delete any worker, BRAND_ADMIN can delete workers in their brand',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async deleteWorker(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<{ message: string }> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const requester = await this.workersService.findByKeycloakId(keycloakId);
    if (!requester) {
      throw new UnauthorizedException('User not found');
    }

    // Get target worker first
    const targetWorker = await this.workersService.findById(id);
    if (!targetWorker) {
      throw new NotFoundException('Worker not found');
    }

    // Check permissions
    if (requester.role === WorkerRole.SYSTEM_ADMIN) {
      // SYSTEM_ADMIN can delete any worker except themselves
      if (requester.id === id) {
        throw new BadRequestException('Cannot delete your own account');
      }
      if (targetWorker.role === WorkerRole.SYSTEM_ADMIN) {
        throw new BadRequestException('Cannot delete SYSTEM_ADMIN accounts');
      }
    } else if (requester.role === WorkerRole.BRAND_ADMIN) {
      // BRAND_ADMIN can only delete workers in their brand
      if (targetWorker.brandId !== requester.brandId) {
        throw new BadRequestException('Can only delete workers in your brand');
      }
      if (requester.id === id) {
        throw new BadRequestException('Cannot delete your own account');
      }
    } else {
      throw new BadRequestException(
        'Only SYSTEM_ADMIN and BRAND_ADMIN can delete workers',
      );
    }

    await this.keycloakService.deleteUser(targetWorker.keycloakId);
    await this.workersService.softDelete(id);

    return { message: 'Worker account deleted successfully' };
  }
}

@ApiTags('Admin Workers')
@Controller('admin/workers')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AdminWorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all workers (SYSTEM_ADMIN only)',
    description: 'Returns paginated list of all workers',
  })
  @ApiResponse({
    status: 200,
    description: 'List of workers',
    type: WorkerListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  async findAll(
    @Query() query: WorkerListQueryDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<WorkerListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.workersService.findAll(keycloakId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get worker by ID (SYSTEM_ADMIN only)',
    description: 'Returns worker details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker details',
    type: WorkerProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<WorkerProfileDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findOneById(keycloakId, id);
    if (!worker) {
      throw new NotFoundException('Worker not found');
    }

    return {
      id: worker.id,
      email: worker.email,
      firstName: worker.firstName,
      lastName: worker.lastName,
      role: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId: worker.cafeId ?? undefined,
      createdAt: worker.createdAt,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update worker (SYSTEM_ADMIN only)',
    description: 'Updates worker details',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker updated successfully',
    type: WorkerProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkerDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<WorkerProfileDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const updated = await this.workersService.updateById(keycloakId, id, dto);

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      brandId: updated.brandId ?? undefined,
      cafeId: updated.cafeId ?? undefined,
      createdAt: updated.createdAt,
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update worker by ID',
    description:
      'Updates worker details. SYSTEM_ADMIN can update any worker, BRAND_ADMIN can update workers in their brand',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker updated successfully',
    type: WorkerProfileDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async updateWorker(
    @Param('id') id: string,
    @Body() dto: UpdateWorkerDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<WorkerProfileDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const requester = await this.workersService.findByKeycloakId(keycloakId);
    if (!requester) {
      throw new UnauthorizedException('User not found');
    }

    // Get target worker
    const targetWorker = await this.workersService.findById(id);
    if (!targetWorker) {
      throw new NotFoundException('Worker not found');
    }

    // Check permissions
    if (requester.role === WorkerRole.SYSTEM_ADMIN) {
      // SYSTEM_ADMIN can update any worker
    } else if (requester.role === WorkerRole.BRAND_ADMIN) {
      // BRAND_ADMIN can only update workers in their brand
      if (targetWorker.brandId !== requester.brandId) {
        throw new BadRequestException('Can only update workers in your brand');
      }
    } else {
      throw new BadRequestException(
        'Only SYSTEM_ADMIN and BRAND_ADMIN can update workers',
      );
    }

    const updated = await this.workersService.update(id, dto);

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      role: updated.role,
      brandId: updated.brandId ?? undefined,
      cafeId: updated.cafeId ?? undefined,
      createdAt: updated.createdAt,
    };
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete worker (SYSTEM_ADMIN only)',
    description: 'Soft deletes worker account',
  })
  @ApiResponse({
    status: 200,
    description: 'Worker deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Worker not found',
  })
  async delete(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<{ message: string }> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    await this.workersService.deleteById(keycloakId, id);

    return { message: 'Worker account deleted successfully' };
  }
}
