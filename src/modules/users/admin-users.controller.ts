import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
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
import { UsersService } from './users.service';
import { WorkersService } from '../workers/workers.service';
import { WorkerRole } from '@prisma/client';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { AdminUserListResponseDto } from './dto/admin-user-list-response.dto';
import { AdminUserListItemDto } from './dto/admin-user-list-item.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@ApiTags('Admin Users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly workersService: WorkersService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: AdminUserListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  async findAll(
    @Query() query: AdminUserListQueryDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AdminUserListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can view users');
    }

    return this.usersService.findAllAdmin(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: AdminUserListItemDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AdminUserListItemDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can view users');
    }

    return this.usersService.findOneAdmin(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: AdminUserListItemDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: AdminUpdateUserDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AdminUserListItemDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can update users');
    }

    const updated = await this.usersService.updateAdmin(id, updateDto);
    return this.usersService.findOneAdmin(updated.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user (soft delete, SYSTEM_ADMIN only)' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<void> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can delete users');
    }

    return this.usersService.deleteAdmin(id);
  }
}
