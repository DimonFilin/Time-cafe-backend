import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, BrandStatus } from '@prisma/client';
import { CreateCafeDto } from './dto/create-cafe.dto';
import { UpdateCafeDto } from './dto/update-cafe.dto';
import { CafeResponseDto } from './dto/cafe-response.dto';
import { CafeListItemDto } from './dto/cafe-list-item.dto';
import {
  CafeListQueryDto,
  CafeSortBy,
  SortOrder,
} from './dto/cafe-list-query.dto';
import { CafeListResponseDto } from './dto/cafe-list-response.dto';
import { GeocodeResponseDto } from './dto/geocode.dto';
import { ReverseGeocodeResponseDto } from './dto/reverse-geocode.dto';
import {
  NominatimSearchResult,
  NominatimReverseResult,
} from './types/nominatim.types';
import { WorkersService } from '../workers/workers.service';
import { WorkerRole } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CafesService {
  private readonly logger = new Logger(CafesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Check if user has access to cafe operations
   * SYSTEM_ADMIN has access to all cafes
   * BRAND_ADMIN has access to cafes of their brand
   */
  private async checkCafeAccess(
    brandId: string,
    keycloakId: string,
  ): Promise<void> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new ForbiddenException('Worker account not found');
    }

    // SYSTEM_ADMIN has access to all cafes
    if (worker.role === WorkerRole.SYSTEM_ADMIN) {
      return;
    }

    // BRAND_ADMIN must be assigned to this specific brand
    if (worker.role === WorkerRole.BRAND_ADMIN && worker.brandId === brandId) {
      return;
    }

    throw new ForbiddenException(
      'Only BRAND_ADMIN of this brand or SYSTEM_ADMIN can perform this action',
    );
  }

  /**
   * Create cafe
   */
  async create(
    keycloakId: string,
    createCafeDto: CreateCafeDto,
  ): Promise<CafeResponseDto> {
    // Check brand exists, is active and not deleted
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: createCafeDto.brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(
        `Brand with ID ${createCafeDto.brandId} not found`,
      );
    }

    if (brand.status !== BrandStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot create cafe for brand with status ${brand.status}. Brand must be ACTIVE`,
      );
    }

    // Check region exists
    const region = await this.prisma.region.findUnique({
      where: { id: createCafeDto.regionId },
    });

    if (!region) {
      throw new NotFoundException(
        `Region with ID ${createCafeDto.regionId} not found`,
      );
    }

    // Check access rights
    await this.checkCafeAccess(createCafeDto.brandId, keycloakId);

    // Validate coordinates
    if (
      createCafeDto.latitude < -90 ||
      createCafeDto.latitude > 90 ||
      createCafeDto.longitude < -180 ||
      createCafeDto.longitude > 180
    ) {
      throw new BadRequestException('Invalid coordinates');
    }

    // Create cafe
    const cafe = await this.prisma.cafe.create({
      data: {
        name: createCafeDto.name,
        description: createCafeDto.description,
        address: createCafeDto.address,
        city: createCafeDto.city,
        street: createCafeDto.street,
        latitude: createCafeDto.latitude,
        longitude: createCafeDto.longitude,
        brandId: createCafeDto.brandId,
        regionId: createCafeDto.regionId,
        photos: createCafeDto.photos || [],
        cafeApiUrl: createCafeDto.cafeApiUrl,
        rating: 0,
        reviewsCount: 0,
      },
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        region: {
          select: {
            name: true,
          },
        },
      },
    });

    this.logger.log(
      `Cafe created: ${cafe.id} for brand ${createCafeDto.brandId}`,
    );
    return this.mapToResponseDto(cafe);
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get all cafes with optional filters
   * Excludes soft-deleted cafes
   */
  async findAll(filters?: {
    brandId?: string;
    regionId?: string;
    city?: string;
  }): Promise<CafeResponseDto[]> {
    const where: Prisma.CafeWhereInput = {
      deletedAt: null, // Exclude soft-deleted cafes
    };

    if (filters?.brandId) {
      where.brandId = filters.brandId;
    }

    if (filters?.regionId) {
      where.regionId = filters.regionId;
    }

    if (filters?.city) {
      where.city = {
        contains: filters.city,
        mode: 'insensitive',
      };
    }

    const cafes = await this.prisma.cafe.findMany({
      where,
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        region: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cafes.map((cafe) => this.mapToResponseDto(cafe));
  }

  /**
   * Get cafes list for mobile app with pagination, sorting, and radius search
   */
  async findList(query: CafeListQueryDto): Promise<CafeListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Prisma.CafeWhereInput = {
      deletedAt: null, // Exclude soft-deleted cafes
    };

    // Apply filters
    if (query.brandId) {
      where.brandId = query.brandId;
    }

    if (query.regionId) {
      where.regionId = query.regionId;
    }

    if (query.city) {
      where.city = {
        contains: query.city,
        mode: 'insensitive',
      };
    }

    // Apply country filter through region
    if (query.country) {
      const regions = await this.prisma.region.findMany({
        where: {
          country: {
            contains: query.country,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });
      const regionIds = regions.map((r) => r.id);
      if (regionIds.length > 0) {
        where.regionId = { in: regionIds };
      } else {
        // No regions found for this country, return empty result
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
    }

    // Apply full-text search
    if (query.search) {
      where.OR = [
        {
          name: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          address: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Fetch all cafes matching filters (we'll filter by radius in memory)
    const allCafes = await this.prisma.cafe.findMany({
      where,
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        region: {
          select: {
            name: true,
            country: true,
          },
        },
      },
    });

    // Map to list items and calculate distances if location provided
    let items: CafeListItemDto[] = allCafes.map((cafe) => ({
      id: cafe.id,
      name: cafe.name,
      address: cafe.address,
      city: cafe.city,
      latitude: cafe.latitude,
      longitude: cafe.longitude,
      photos: cafe.photos,
      rating: cafe.rating || 0,
      reviewsCount: cafe.reviewsCount,
      brandId: cafe.brandId,
      brandName: cafe.brand?.name,
    }));

    // Calculate distances if location provided
    if (query.latitude !== undefined && query.longitude !== undefined) {
      items = items.map((item) => {
        const distance = this.calculateDistance(
          query.latitude!,
          query.longitude!,
          item.latitude,
          item.longitude,
        );
        return { ...item, distance: Math.round(distance * 10) / 10 }; // Round to 1 decimal
      });

      // Filter by radius if provided
      if (query.radius !== undefined) {
        items = items.filter((item) => item.distance! <= query.radius!);
      }

      // Sort by distance if sortBy is DISTANCE
      if (query.sortBy === CafeSortBy.DISTANCE) {
        items.sort((a, b) => {
          const distA = a.distance || Infinity;
          const distB = b.distance || Infinity;
          return query.sortOrder === SortOrder.ASC
            ? distA - distB
            : distB - distA;
        });
      }
    }

    // Apply other sorting if not distance
    if (query.sortBy !== CafeSortBy.DISTANCE) {
      if (query.sortBy === CafeSortBy.RATING) {
        items.sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          return query.sortOrder === SortOrder.ASC
            ? ratingA - ratingB
            : ratingB - ratingA;
        });
      } else if (query.sortBy === CafeSortBy.REVIEWS_COUNT) {
        items.sort((a, b) => {
          const countA = a.reviewsCount || 0;
          const countB = b.reviewsCount || 0;
          return query.sortOrder === SortOrder.ASC
            ? countA - countB
            : countB - countA;
        });
      } else {
        // Default: sort by createdAt desc (need to fetch from DB)
        items.sort((a, b) => {
          const cafeA = allCafes.find((c) => c.id === a.id);
          const cafeB = allCafes.find((c) => c.id === b.id);
          const dateA = cafeA?.createdAt.getTime() || 0;
          const dateB = cafeB?.createdAt.getTime() || 0;
          return query.sortOrder === SortOrder.ASC
            ? dateA - dateB
            : dateB - dateA;
        });
      }
    }

    // Get total after radius filtering
    const total = items.length;

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedItems = items.slice(skip, skip + limit);

    const totalPages = Math.ceil(total / limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get cafe by ID
   * Excludes soft-deleted cafes
   */
  async findOne(id: string): Promise<CafeResponseDto> {
    const cafe = await this.prisma.cafe.findFirst({
      where: {
        id,
        deletedAt: null, // Exclude soft-deleted cafes
      },
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        region: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!cafe) {
      throw new NotFoundException(`Cafe with ID ${id} not found`);
    }

    return this.mapToResponseDto(cafe);
  }

  /**
   * Update cafe
   * Cannot update soft-deleted cafes
   */
  async update(
    id: string,
    keycloakId: string,
    updateCafeDto: UpdateCafeDto,
  ): Promise<CafeResponseDto> {
    const cafe = await this.prisma.cafe.findFirst({
      where: {
        id,
        deletedAt: null, // Cannot update soft-deleted cafes
      },
      include: {
        brand: true,
      },
    });

    if (!cafe) {
      throw new NotFoundException(`Cafe with ID ${id} not found`);
    }

    // Check access rights
    await this.checkCafeAccess(cafe.brandId, keycloakId);

    // If brandId is being updated, check new brand exists and is active
    if (updateCafeDto.brandId && updateCafeDto.brandId !== cafe.brandId) {
      const newBrand = await this.prisma.brand.findFirst({
        where: {
          id: updateCafeDto.brandId,
          deletedAt: null,
        } as Prisma.BrandWhereInput,
      });

      if (!newBrand) {
        throw new NotFoundException(
          `Brand with ID ${updateCafeDto.brandId} not found`,
        );
      }

      if (newBrand.status !== BrandStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot assign cafe to brand with status ${newBrand.status}. Brand must be ACTIVE`,
        );
      }

      // Check access to new brand
      await this.checkCafeAccess(updateCafeDto.brandId, keycloakId);
    }

    // If regionId is being updated, check region exists
    if (updateCafeDto.regionId) {
      const region = await this.prisma.region.findUnique({
        where: { id: updateCafeDto.regionId },
      });

      if (!region) {
        throw new NotFoundException(
          `Region with ID ${updateCafeDto.regionId} not found`,
        );
      }
    }

    // Validate coordinates if provided
    if (
      updateCafeDto.latitude !== undefined &&
      (updateCafeDto.latitude < -90 || updateCafeDto.latitude > 90)
    ) {
      throw new BadRequestException('Invalid latitude');
    }

    if (
      updateCafeDto.longitude !== undefined &&
      (updateCafeDto.longitude < -180 || updateCafeDto.longitude > 180)
    ) {
      throw new BadRequestException('Invalid longitude');
    }

    // Update cafe
    const updatedCafe = await this.prisma.cafe.update({
      where: { id },
      data: {
        ...(updateCafeDto.name && { name: updateCafeDto.name }),
        ...(updateCafeDto.description !== undefined && {
          description: updateCafeDto.description,
        }),
        ...(updateCafeDto.address && { address: updateCafeDto.address }),
        ...(updateCafeDto.city && { city: updateCafeDto.city }),
        ...(updateCafeDto.street !== undefined && {
          street: updateCafeDto.street,
        }),
        ...(updateCafeDto.latitude !== undefined && {
          latitude: updateCafeDto.latitude,
        }),
        ...(updateCafeDto.longitude !== undefined && {
          longitude: updateCafeDto.longitude,
        }),
        ...(updateCafeDto.brandId && { brandId: updateCafeDto.brandId }),
        ...(updateCafeDto.regionId && { regionId: updateCafeDto.regionId }),
        ...(updateCafeDto.photos !== undefined && {
          photos: updateCafeDto.photos,
        }),
        ...(updateCafeDto.cafeApiUrl !== undefined && {
          cafeApiUrl: updateCafeDto.cafeApiUrl,
        }),
      },
      include: {
        brand: {
          select: {
            name: true,
          },
        },
        region: {
          select: {
            name: true,
          },
        },
      },
    });

    this.logger.log(`Cafe updated: ${id}`);
    return this.mapToResponseDto(updatedCafe);
  }

  /**
   * Delete cafe (soft delete)
   */
  async remove(id: string, keycloakId: string): Promise<void> {
    const cafe = await this.prisma.cafe.findUnique({
      where: { id },
      include: {
        brand: true,
      },
    });

    if (!cafe) {
      throw new NotFoundException(`Cafe with ID ${id} not found`);
    }

    // Check access rights
    await this.checkCafeAccess(cafe.brandId, keycloakId);

    // Check if already deleted
    if (cafe.deletedAt) {
      throw new NotFoundException(`Cafe with ID ${id} not found`);
    }

    // Soft delete cafe
    await this.prisma.cafe.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Cafe soft-deleted: ${id}`);
  }

  /**
   * Map Prisma Cafe to response DTO
   */
  private mapToResponseDto(cafe: {
    id: string;
    name: string;
    description?: string | null;
    address: string;
    city: string;
    street?: string | null;
    latitude: number;
    longitude: number;
    photos: string[];
    rating: number | null;
    reviewsCount: number;
    brandId: string;
    regionId: string;
    cafeApiUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
    brand?: { name: string } | null;
    region?: { name: string } | null;
  }): CafeResponseDto {
    return {
      id: cafe.id,
      name: cafe.name,
      description: cafe.description || undefined,
      address: cafe.address,
      city: cafe.city,
      street: cafe.street || undefined,
      latitude: cafe.latitude,
      longitude: cafe.longitude,
      photos: cafe.photos,
      rating: cafe.rating || 0,
      reviewsCount: cafe.reviewsCount,
      brandId: cafe.brandId,
      brandName: cafe.brand?.name,
      regionId: cafe.regionId,
      regionName: cafe.region?.name,
      cafeApiUrl: cafe.cafeApiUrl || undefined,
      createdAt: cafe.createdAt,
      updatedAt: cafe.updatedAt,
    };
  }

  /**
   * Geocode address to coordinates using Nominatim (OpenStreetMap)
   */
  async geocode(address: string): Promise<GeocodeResponseDto> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<NominatimSearchResult[]>(
          'https://nominatim.openstreetmap.org/search',
          {
            params: {
              q: address,
              format: 'json',
              limit: 1,
              addressdetails: 1,
            },
            headers: {
              'User-Agent': 'TimeCaffe/1.0',
            },
          },
        ),
      );

      if (!response.data || response.data.length === 0) {
        throw new NotFoundException(`Address "${address}" not found`);
      }

      const result = response.data[0];
      const addressDetails = result.address || {};

      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        formattedAddress: result.display_name || address,
        city:
          addressDetails.city || addressDetails.town || addressDetails.village,
        country: addressDetails.country,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Unknown error';
      this.logger.error(
        `Geocoding failed for address "${address}": ${errorMessage}`,
      );
      throw new BadRequestException(
        `Failed to geocode address: ${errorMessage}`,
      );
    }
  }

  /**
   * Reverse geocode coordinates to address using Nominatim (OpenStreetMap)
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResponseDto> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<NominatimReverseResult>(
          'https://nominatim.openstreetmap.org/reverse',
          {
            params: {
              lat: latitude,
              lon: longitude,
              format: 'json',
              addressdetails: 1,
            },
            headers: {
              'User-Agent': 'TimeCaffe/1.0',
            },
          },
        ),
      );

      if (!response.data || !response.data.address) {
        throw new NotFoundException(
          `No address found for coordinates (${latitude}, ${longitude})`,
        );
      }

      const addressDetails = response.data.address || {};

      return {
        formattedAddress:
          response.data.display_name || `${latitude}, ${longitude}`,
        city:
          addressDetails.city || addressDetails.town || addressDetails.village,
        country: addressDetails.country,
        street: addressDetails.road || addressDetails.street,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Unknown error';
      this.logger.error(
        `Reverse geocoding failed for coordinates (${latitude}, ${longitude}): ${errorMessage}`,
      );
      throw new BadRequestException(
        `Failed to reverse geocode coordinates: ${errorMessage}`,
      );
    }
  }
}
