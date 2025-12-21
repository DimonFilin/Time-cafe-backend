import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from 'nest-keycloak-connect';
import { WorkersService } from './workers.service';
import { KeycloakService } from '../auth/services/keycloak.service';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { WorkerProfileDto } from './dto/worker-profile.dto';

@ApiTags('Workers')
@Controller('auth/workers')
export class WorkersController {
  constructor(
    private readonly workersService: WorkersService,
    private readonly keycloakService: KeycloakService,
  ) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new worker',
    description: 'Creates a new worker account in Keycloak and database',
  })
  @ApiResponse({
    status: 201,
    description: 'Worker successfully registered',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Worker with this email already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async register(@Body() dto: RegisterWorkerDto): Promise<AuthResponseDto> {
    return this.workersService.register(dto);
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
    @Request() req: { user?: { sub?: string } },
  ): Promise<WorkerProfileDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
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
}
