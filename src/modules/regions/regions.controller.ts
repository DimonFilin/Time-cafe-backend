import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { RegionsService } from './regions.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionResponseDto } from './dto/region-response.dto';
import { RegionListQueryDto } from './dto/region-list-query.dto';
import { RegionListResponseDto } from './dto/region-list-response.dto';
import { WorkersService } from '../workers/workers.service';
import { WorkerRole } from '@prisma/client';

@ApiTags('Regions')
@Controller('regions')
export class RegionsController {
  constructor(
    private readonly regionsService: RegionsService,
    private readonly workersService: WorkersService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create region (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 201,
    description: 'Region created successfully',
    type: RegionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  async create(
    @Body() createRegionDto: CreateRegionDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<RegionResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new Error('User ID not found in token');
    }

    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new Error('Only SYSTEM_ADMIN can create regions');
    }

    return this.regionsService.create(createRegionDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get list of regions (BRAND_ADMIN and above)' })
  @ApiResponse({
    status: 200,
    description: 'List of regions',
    type: RegionListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role or higher required',
  })
  async findAll(
    @Query() query: RegionListQueryDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<RegionListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new Error('User ID not found in token');
    }

    // Check if user is BRAND_ADMIN or SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (
      !worker ||
      (worker.role !== WorkerRole.BRAND_ADMIN &&
        worker.role !== WorkerRole.SYSTEM_ADMIN)
    ) {
      throw new Error('Only BRAND_ADMIN and above can view regions');
    }

    return this.regionsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get region by ID (BRAND_ADMIN and above)' })
  @ApiResponse({
    status: 200,
    description: 'Region details',
    type: RegionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role or higher required',
  })
  @ApiResponse({ status: 404, description: 'Region not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<RegionResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new Error('User ID not found in token');
    }

    // Check if user is BRAND_ADMIN or SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (
      !worker ||
      (worker.role !== WorkerRole.BRAND_ADMIN &&
        worker.role !== WorkerRole.SYSTEM_ADMIN)
    ) {
      throw new Error('Only BRAND_ADMIN and above can view regions');
    }

    return this.regionsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update region (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Region updated successfully',
    type: RegionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Region not found' })
  async update(
    @Param('id') id: string,
    @Body() updateRegionDto: UpdateRegionDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<RegionResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new Error('User ID not found in token');
    }

    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new Error('Only SYSTEM_ADMIN can update regions');
    }

    return this.regionsService.update(id, updateRegionDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete region (SYSTEM_ADMIN only)' })
  @ApiResponse({ status: 204, description: 'Region deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Region not found' })
  async remove(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<void> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new Error('User ID not found in token');
    }

    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new Error('Only SYSTEM_ADMIN can delete regions');
    }

    return this.regionsService.remove(id);
  }
}
