import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CafesService } from './cafes.service';
import { CreateCafeDto } from './dto/create-cafe.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';
import { CafeResponseDto } from './dto/cafe-response.dto';
import { CafeListQueryDto } from './dto/cafe-list-query.dto';
import { CafeListResponseDto } from './dto/cafe-list-response.dto';
import { GeocodeDto, GeocodeResponseDto } from './dto/geocode.dto';
import {
  ReverseGeocodeDto,
  ReverseGeocodeResponseDto,
} from './dto/reverse-geocode.dto';
import { AuthGuard } from 'nest-keycloak-connect';
import { Public } from 'nest-keycloak-connect';

@ApiTags('Cafes')
@Controller('cafes')
export class CafesController {
  constructor(private readonly cafesService: CafesService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create cafe (BRAND_ADMIN or SYSTEM_ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Cafe created successfully',
    type: CafeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN or SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand or region not found' })
  async create(
    @Body() createCafeDto: CreateCafeDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<CafeResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.cafesService.create(keycloakId, createCafeDto);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary:
      'Get cafes list with pagination, sorting, and filters (for mobile app)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of cafes',
    type: CafeListResponseDto,
  })
  async findList(
    @Query() query: CafeListQueryDto,
  ): Promise<CafeListResponseDto> {
    return this.cafesService.findList(query);
  }

  @Get('my')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my cafe (CAFE_ADMIN only)',
    description:
      'Returns the cafe assigned to the current CAFE_ADMIN. Requires CAFE_ADMIN role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cafe details',
    type: CafeResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - CAFE_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Cafe not found or not assigned' })
  async findMyCafe(
    @Request() req: { user?: { sub?: string } },
  ): Promise<CafeResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.cafesService.findMyCafe(keycloakId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get cafe by ID' })
  @ApiResponse({
    status: 200,
    description: 'Cafe details',
    type: CafeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Cafe not found' })
  async findOne(@Param('id') id: string): Promise<CafeResponseDto> {
    return this.cafesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update cafe (BRAND_ADMIN of cafe brand, CAFE_ADMIN of this cafe, or SYSTEM_ADMIN)',
    description:
      'CAFE_ADMIN can update their assigned cafe but cannot change brandId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cafe updated successfully',
    type: CafeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - BRAND_ADMIN, CAFE_ADMIN, or SYSTEM_ADMIN role required. CAFE_ADMIN cannot change brandId.',
  })
  @ApiResponse({ status: 404, description: 'Cafe not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCafeDto: UpdateCafeDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<CafeResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.cafesService.update(id, keycloakId, updateCafeDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete cafe (BRAND_ADMIN of cafe brand or SYSTEM_ADMIN only)',
    description:
      'CAFE_ADMIN cannot delete cafes. Only BRAND_ADMIN and SYSTEM_ADMIN can delete.',
  })
  @ApiResponse({ status: 204, description: 'Cafe deleted' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN or SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Cafe not found' })
  async remove(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<void> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.cafesService.remove(id, keycloakId);
  }

  @Post('geocode')
  @Public()
  @ApiOperation({ summary: 'Geocode address to coordinates (Nominatim)' })
  @ApiResponse({
    status: 200,
    description: 'Address geocoded successfully',
    type: GeocodeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async geocode(@Body() geocodeDto: GeocodeDto): Promise<GeocodeResponseDto> {
    return this.cafesService.geocode(geocodeDto.address);
  }

  @Post('reverse-geocode')
  @Public()
  @ApiOperation({
    summary: 'Reverse geocode coordinates to address (Nominatim)',
  })
  @ApiResponse({
    status: 200,
    description: 'Coordinates reverse geocoded successfully',
    type: ReverseGeocodeResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({
    status: 404,
    description: 'Address not found for coordinates',
  })
  async reverseGeocode(
    @Body() reverseGeocodeDto: ReverseGeocodeDto,
  ): Promise<ReverseGeocodeResponseDto> {
    return this.cafesService.reverseGeocode(
      reverseGeocodeDto.latitude,
      reverseGeocodeDto.longitude,
    );
  }
}
