import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Region } from '@prisma/client';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { RegionResponseDto } from './dto/region-response.dto';
import { RegionListQueryDto } from './dto/region-list-query.dto';
import { RegionListResponseDto } from './dto/region-list-response.dto';

@Injectable()
export class RegionsService {
  private readonly logger = new Logger(RegionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new region
   */
  async create(createRegionDto: CreateRegionDto): Promise<RegionResponseDto> {
    const region = await this.prisma.region.create({
      data: {
        name: createRegionDto.name,
        country: createRegionDto.country,
      },
    });

    return this.mapToResponseDto(region);
  }

  /**
   * Get all regions with pagination
   */
  async findAll(query: RegionListQueryDto): Promise<RegionListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [regions, total] = await Promise.all([
      this.prisma.region.findMany({
        orderBy: { name: 'asc' },
        take: limit,
        skip,
      }),
      this.prisma.region.count(),
    ]);

    return {
      items: regions.map((region) => this.mapToResponseDto(region)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get region by ID
   */
  async findOne(regionId: string): Promise<RegionResponseDto> {
    const region = await this.prisma.region.findUnique({
      where: { id: regionId },
    });

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    return this.mapToResponseDto(region);
  }

  /**
   * Update region
   */
  async update(
    regionId: string,
    updateRegionDto: UpdateRegionDto,
  ): Promise<RegionResponseDto> {
    const region = await this.prisma.region.findUnique({
      where: { id: regionId },
    });

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    const updatedRegion = await this.prisma.region.update({
      where: { id: regionId },
      data: updateRegionDto,
    });

    return this.mapToResponseDto(updatedRegion);
  }

  /**
   * Delete region (soft delete if there are related cafes)
   */
  async remove(regionId: string): Promise<void> {
    const region = await this.prisma.region.findUnique({
      where: { id: regionId },
      include: {
        cafes: {
          where: { deletedAt: null },
        },
      },
    });

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    // Check if region has active cafes
    if (region.cafes.length > 0) {
      throw new NotFoundException(
        'Cannot delete region with active cafes. Remove or reassign cafes first.',
      );
    }

    await this.prisma.region.delete({
      where: { id: regionId },
    });
  }

  /**
   * Map Prisma region to response DTO
   */
  private mapToResponseDto(region: Region): RegionResponseDto {
    return {
      id: region.id,
      name: region.name,
      country: region.country,
      createdAt: region.createdAt,
      updatedAt: region.updatedAt,
    };
  }
}
