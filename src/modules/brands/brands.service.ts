import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, BrandStatus, DocumentType, WorkerRole } from '@prisma/client';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandResponseDto } from './dto/brand-response.dto';
import { StorageService } from '../storage/storage.service';
import { DocumentResponseDto } from './dto/document-response.dto';
import { FileValidator } from '../storage/utils/file-validator';
import { WorkersService } from '../workers/workers.service';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';
import { CreateApiKeyResponseDto } from './dto/create-api-key-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly workersService: WorkersService,
  ) {}

  /**
   * Get default brand settings
   */
  private getDefaultSettings(): Record<string, unknown> {
    return {
      theme: {
        mode: 'light',
        borderRadius: '8px',
        spacing: 'normal',
      },
      features: {
        onlineOrders: true,
        reservations: true,
        loyaltyProgram: false,
        giftCards: false,
      },
      notifications: {
        email: true,
        sms: false,
        push: false,
      },
    };
  }

  /**
   * Create brand (SYSTEM_ADMIN only)
   */
  async create(
    keycloakId: string,
    createBrandDto: CreateBrandDto,
  ): Promise<BrandResponseDto> {
    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can create brands');
    }

    const defaultSettings = this.getDefaultSettings();
    const mergedSettings = {
      ...defaultSettings,
      ...(createBrandDto.settings || {}),
    };

    const brand = await this.prisma.brand.create({
      data: {
        name: createBrandDto.name,
        description: createBrandDto.description,
        email: createBrandDto.email,
        phone: createBrandDto.phone,
        address: createBrandDto.address,
        website: createBrandDto.website,
        primaryColor: '#000000',
        secondaryColor: '#FFFFFF',
        accentColor: '#007BFF',
        backgroundColor: '#F8F9FA',
        textColor: '#212529',
        fontFamily: 'Inter, sans-serif',
        status: BrandStatus.PENDING,
        isVerified: false,
        settings: mergedSettings as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Brand created: ${brand.id} (${brand.name})`);
    return this.mapToResponseDto(brand);
  }

  /**
   * Find all brands
   */
  async findAll(status?: BrandStatus): Promise<BrandResponseDto[]> {
    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
    };

    const brands = await this.prisma.brand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return brands.map((brand) => this.mapToResponseDto(brand));
  }

  /**
   * Find brand by ID
   */
  async findOne(id: string): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return this.mapToResponseDto(brand);
  }

  /**
   * Update brand (BRAND_ADMIN of brand or SYSTEM_ADMIN)
   */
  async update(
    id: string,
    keycloakId: string,
    updateBrandDto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    // Check access rights
    await this.checkBrandAccess(id, keycloakId);

    const updateData: Record<string, unknown> = {};

    if (updateBrandDto.name !== undefined)
      updateData.name = updateBrandDto.name;
    if (updateBrandDto.description !== undefined)
      updateData.description = updateBrandDto.description;
    if (updateBrandDto.email !== undefined)
      updateData.email = updateBrandDto.email;
    if (updateBrandDto.phone !== undefined)
      updateData.phone = updateBrandDto.phone;
    if (updateBrandDto.address !== undefined)
      updateData.address = updateBrandDto.address;
    if (updateBrandDto.website !== undefined)
      updateData.website = updateBrandDto.website;

    if (updateBrandDto.settings !== undefined) {
      const currentSettings = (brand.settings as Record<string, unknown>) || {};
      updateData.settings = {
        ...currentSettings,
        ...updateBrandDto.settings,
      } as Prisma.InputJsonValue;
    }

    const updatedBrand = await this.prisma.brand.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Brand updated: ${id}`);
    return this.mapToResponseDto(updatedBrand);
  }

  /**
   * Delete brand (soft delete)
   */
  async remove(id: string): Promise<void> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    await this.prisma.brand.update({
      where: { id },
      data: { deletedAt: new Date() } as Prisma.BrandUpdateInput,
    });

    this.logger.log(`Brand deleted (soft): ${id}`);
  }

  /**
   * Get storage path for brand files
   */
  getBrandStoragePath(
    brandId: string,
    type: 'logo' | 'banner' | 'documents',
  ): string {
    return `brands/${brandId}/${type}`;
  }

  /**
   * Upload document for brand
   */
  async uploadDocument(
    brandId: string,
    type: DocumentType,
    name: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname?: string;
    },
  ): Promise<DocumentResponseDto> {
    // Check if brand exists
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    // Validate file
    FileValidator.validateDocument(file);

    // Generate file path
    const fileName = file.originalname || `document-${Date.now()}`;
    const storagePath = `${this.getBrandStoragePath(brandId, 'documents')}/${Date.now()}-${fileName}`;

    // Upload to MinIO
    const uploadResult = await this.storageService.uploadFile(
      this.storageService.getBuckets().brands,
      storagePath,
      file,
    );

    // Save document metadata to database
    const document = await this.prisma.brandDocument.create({
      data: {
        brandId,
        type,
        name,
        fileUrl: uploadResult.url,
        fileType: file.mimetype,
        fileSize: file.size,
        isVerified: false,
      },
    });

    this.logger.log(`Document uploaded for brand ${brandId}: ${document.id}`);
    return this.mapDocumentToResponseDto(document);
  }

  /**
   * Get all documents for brand
   */
  async getBrandDocuments(brandId: string): Promise<DocumentResponseDto[]> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    const documents = await this.prisma.brandDocument.findMany({
      where: { brandId },
      orderBy: { uploadedAt: 'desc' },
    });

    return documents.map((doc) => this.mapDocumentToResponseDto(doc));
  }

  /**
   * Get document by ID
   */
  async getDocument(
    brandId: string,
    documentId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.prisma.brandDocument.findFirst({
      where: {
        id: documentId,
        brandId,
      },
    });

    if (!document) {
      throw new NotFoundException(
        `Document with ID ${documentId} not found for brand ${brandId}`,
      );
    }

    return this.mapDocumentToResponseDto(document);
  }

  /**
   * Verify document (SYSTEM_ADMIN only)
   */
  async verifyDocument(
    brandId: string,
    documentId: string,
    keycloakId: string,
    verificationNote?: string,
  ): Promise<DocumentResponseDto> {
    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can verify documents');
    }

    const document = await this.prisma.brandDocument.findFirst({
      where: {
        id: documentId,
        brandId,
      },
    });

    if (!document) {
      throw new NotFoundException(
        `Document with ID ${documentId} not found for brand ${brandId}`,
      );
    }

    if (document.isVerified) {
      throw new BadRequestException(
        `Document with ID ${documentId} is already verified`,
      );
    }

    const updatedDocument = await this.prisma.brandDocument.update({
      where: { id: documentId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: worker.id,
        verificationNote: verificationNote || null,
      },
    });

    this.logger.log(`Document verified: ${documentId} by worker ${worker.id}`);
    return this.mapDocumentToResponseDto(updatedDocument);
  }

  /**
   * Verify brand (SYSTEM_ADMIN only)
   * Checks that all required documents are verified before activation
   */
  async verifyBrand(
    brandId: string,
    keycloakId: string,
  ): Promise<BrandResponseDto> {
    // Check if user is SYSTEM_ADMIN
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can verify brands');
    }

    // Check if brand exists
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
      include: {
        legalDocuments: true,
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    if (brand.status === BrandStatus.ACTIVE && brand.isVerified) {
      throw new BadRequestException('Brand is already verified and active');
    }

    // Required document types for brand activation
    const requiredDocumentTypes: DocumentType[] = [
      DocumentType.REGISTRATION,
      DocumentType.LICENSE,
      DocumentType.CONTRACT,
    ];

    // Check that all required documents are uploaded and verified
    const documents = brand.legalDocuments;
    const uploadedTypes = new Set(documents.map((doc) => doc.type));

    // Check if all required document types are uploaded
    const missingTypes = requiredDocumentTypes.filter(
      (type) => !uploadedTypes.has(type),
    );
    if (missingTypes.length > 0) {
      throw new BadRequestException(
        `Missing required documents: ${missingTypes.join(', ')}`,
      );
    }

    // Check if all required documents are verified
    const requiredDocuments = documents.filter((doc) =>
      requiredDocumentTypes.includes(doc.type),
    );
    const unverifiedRequired = requiredDocuments.filter(
      (doc) => !doc.isVerified,
    );
    if (unverifiedRequired.length > 0) {
      throw new BadRequestException(
        `The following required documents are not verified: ${unverifiedRequired.map((doc) => doc.type).join(', ')}`,
      );
    }

    // Activate brand
    const updatedBrand = await this.prisma.brand.update({
      where: { id: brandId },
      data: {
        status: BrandStatus.ACTIVE,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    this.logger.log(
      `Brand verified and activated: ${brandId} by worker ${worker.id}`,
    );
    return this.mapToResponseDto(updatedBrand);
  }

  /**
   * Reject brand (SYSTEM_ADMIN only)
   */
  async rejectBrand(
    brandId: string,
    keycloakId: string,
    reason?: string,
  ): Promise<BrandResponseDto> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can reject brands');
    }

    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    if (brand.status === BrandStatus.REJECTED) {
      throw new BadRequestException('Brand is already rejected');
    }

    const updatedBrand = await this.prisma.brand.update({
      where: { id: brandId },
      data: {
        status: BrandStatus.REJECTED,
        isVerified: false,
        ...(reason && {
          settings: {
            ...((brand.settings as Record<string, unknown>) || {}),
            rejectionReason: reason,
          } as Prisma.InputJsonValue,
        }),
      },
    });

    this.logger.log(`Brand rejected: ${brandId} by worker ${worker.id}`);
    return this.mapToResponseDto(updatedBrand);
  }

  /**
   * Suspend brand (SYSTEM_ADMIN only)
   */
  async suspendBrand(
    brandId: string,
    keycloakId: string,
    reason?: string,
  ): Promise<BrandResponseDto> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can suspend brands');
    }

    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    if (brand.status === BrandStatus.SUSPENDED) {
      throw new BadRequestException('Brand is already suspended');
    }

    const updatedBrand = await this.prisma.brand.update({
      where: { id: brandId },
      data: {
        status: BrandStatus.SUSPENDED,
        ...(reason && {
          settings: {
            ...((brand.settings as Record<string, unknown>) || {}),
            suspensionReason: reason,
          } as Prisma.InputJsonValue,
        }),
      },
    });

    this.logger.log(`Brand suspended: ${brandId} by worker ${worker.id}`);
    return this.mapToResponseDto(updatedBrand);
  }

  /**
   * Check if user has access to brand (BRAND_ADMIN for specific brand or SYSTEM_ADMIN)
   */
  private async checkBrandAccess(
    brandId: string,
    keycloakId: string,
  ): Promise<void> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new ForbiddenException('Worker account not found');
    }

    // SYSTEM_ADMIN has access to all brands
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
   * Update brand customization
   */
  async updateCustomization(
    brandId: string,
    keycloakId: string,
    customizationDto: {
      primaryColor?: string;
      secondaryColor?: string;
      accentColor?: string;
      backgroundColor?: string;
      textColor?: string;
      fontFamily?: string;
      settings?: Record<string, unknown>;
    },
  ): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    await this.checkBrandAccess(brandId, keycloakId);

    // Merge settings if provided
    let mergedSettings: Prisma.InputJsonValue | undefined;
    if (customizationDto.settings) {
      const currentSettings = (brand.settings as Record<string, unknown>) || {};
      mergedSettings = {
        ...currentSettings,
        ...customizationDto.settings,
      } as Prisma.InputJsonValue;
    }

    const updatedBrand = await this.prisma.brand.update({
      where: { id: brandId },
      data: {
        primaryColor: customizationDto.primaryColor,
        secondaryColor: customizationDto.secondaryColor,
        accentColor: customizationDto.accentColor,
        backgroundColor: customizationDto.backgroundColor,
        textColor: customizationDto.textColor,
        fontFamily: customizationDto.fontFamily,
        ...(mergedSettings && { settings: mergedSettings }),
      } as Prisma.BrandUpdateInput,
    });

    this.logger.log(`Brand customization updated: ${brandId}`);
    return this.mapToResponseDto(updatedBrand);
  }

  /**
   * Upload logo for brand
   */
  async uploadLogo(
    brandId: string,
    keycloakId: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname?: string;
    },
  ): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    await this.checkBrandAccess(brandId, keycloakId);

    // Validate logo file
    FileValidator.validateLogo(file);

    // Generate file path
    const fileName = file.originalname || `logo-${Date.now()}`;
    const fileExtension = fileName.split('.').pop() || 'png';
    const storagePath = `${this.getBrandStoragePath(brandId, 'logo')}/${Date.now()}-logo.${fileExtension}`;

    // Delete old logo if exists
    if (brand.logo) {
      try {
        const url = new URL(brand.logo);
        const pathParts = url.pathname.split('/').filter((p) => p);
        const brandsIndex = pathParts.findIndex((p) => p === 'brands');
        if (brandsIndex !== -1) {
          const filePath = pathParts.slice(brandsIndex + 1).join('/');
          await this.storageService.deleteFile(
            this.storageService.getBuckets().brands,
            filePath,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete old logo: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Upload new logo
    const uploadResult = await this.storageService.uploadFile(
      this.storageService.getBuckets().brands,
      storagePath,
      file,
    );

    // Update brand with new logo URL
    const updatedBrand = await this.prisma.brand.update({
      where: { id: brandId },
      data: { logo: uploadResult.url } as Prisma.BrandUpdateInput,
    });

    this.logger.log(`Logo uploaded for brand ${brandId}`);
    return this.mapToResponseDto(updatedBrand);
  }

  /**
   * Upload banner for brand
   */
  async uploadBanner(
    brandId: string,
    keycloakId: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname?: string;
    },
  ): Promise<BrandResponseDto> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    await this.checkBrandAccess(brandId, keycloakId);

    // Validate banner file (image, max 5MB)
    FileValidator.validateImage(file);

    // Generate file path
    const fileName = file.originalname || `banner-${Date.now()}`;
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const storagePath = `${this.getBrandStoragePath(brandId, 'banner')}/${Date.now()}-banner.${fileExtension}`;

    // Delete old banner if exists
    if (brand.bannerImage) {
      try {
        const url = new URL(brand.bannerImage);
        const pathParts = url.pathname.split('/').filter((p) => p);
        const brandsIndex = pathParts.findIndex((p) => p === 'brands');
        if (brandsIndex !== -1) {
          const filePath = pathParts.slice(brandsIndex + 1).join('/');
          await this.storageService.deleteFile(
            this.storageService.getBuckets().brands,
            filePath,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to delete old banner: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Upload new banner
    const uploadResult = await this.storageService.uploadFile(
      this.storageService.getBuckets().brands,
      storagePath,
      file,
    );

    // Update brand with new banner URL
    const updatedBrand = await this.prisma.brand.update({
      where: { id: brandId },
      data: { bannerImage: uploadResult.url } as Prisma.BrandUpdateInput,
    });

    this.logger.log(`Banner uploaded for brand ${brandId}`);
    return this.mapToResponseDto(updatedBrand);
  }

  /**
   * Generate API key
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(32);
    const randomPart = randomBytes.toString('base64url').substring(0, 32);
    return `tc_live_${randomPart}`;
  }

  /**
   * Hash API key with SHA-256
   */
  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Get prefix from API key (first 11 characters: "tc_live_xxx")
   */
  private getKeyPrefix(key: string): string {
    return key.substring(0, 11); // "tc_live_" + 3 chars
  }

  /**
   * Create API key for brand
   */
  async createApiKey(
    brandId: string,
    keycloakId: string,
    name: string,
    permissions: string[],
    expiresAt?: Date,
  ): Promise<CreateApiKeyResponseDto> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    await this.checkBrandAccess(brandId, keycloakId);

    // Generate unique API key
    let apiKey: string | undefined;
    let keyHash: string | undefined;
    let attempts = 0;
    const maxAttempts = 10;
    let isUnique = false;

    while (!isUnique && attempts < maxAttempts) {
      apiKey = this.generateApiKey();
      keyHash = this.hashApiKey(apiKey);
      const existing = await this.prisma.brandApiKey.findUnique({
        where: { keyHash },
      });
      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
      }
    }

    if (!isUnique || !apiKey || !keyHash) {
      throw new BadRequestException('Failed to generate unique API key');
    }

    const prefix = this.getKeyPrefix(apiKey);

    // Create API key record
    const apiKeyRecord = await this.prisma.brandApiKey.create({
      data: {
        brandId,
        name,
        keyHash,
        prefix,
        permissions,
        expiresAt: expiresAt || null,
        isActive: true,
      },
    });

    this.logger.log(`API key created for brand ${brandId}: ${apiKeyRecord.id}`);

    return {
      ...this.mapApiKeyToResponseDto(apiKeyRecord),
      key: apiKey, // Show full key only once
    };
  }

  /**
   * Get all API keys for brand
   */
  async getBrandApiKeys(
    brandId: string,
    keycloakId: string,
  ): Promise<ApiKeyResponseDto[]> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        id: brandId,
        deletedAt: null,
      } as Prisma.BrandWhereInput,
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    await this.checkBrandAccess(brandId, keycloakId);

    const apiKeys = await this.prisma.brandApiKey.findMany({
      where: {
        brandId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiKeys.map((key) => this.mapApiKeyToResponseDto(key));
  }

  /**
   * Update API key
   */
  async updateApiKey(
    brandId: string,
    keyId: string,
    keycloakId: string,
    updateDto: {
      name?: string;
      permissions?: string[];
      isActive?: boolean;
      expiresAt?: Date | null;
    },
  ): Promise<ApiKeyResponseDto> {
    const apiKey = await this.prisma.brandApiKey.findFirst({
      where: {
        id: keyId,
        brandId,
        deletedAt: null,
      },
    });

    if (!apiKey) {
      throw new NotFoundException(
        `API key with ID ${keyId} not found for brand ${brandId}`,
      );
    }

    await this.checkBrandAccess(brandId, keycloakId);

    const updatedApiKey = await this.prisma.brandApiKey.update({
      where: { id: keyId },
      data: {
        ...(updateDto.name && { name: updateDto.name }),
        ...(updateDto.permissions && { permissions: updateDto.permissions }),
        ...(updateDto.isActive !== undefined && {
          isActive: updateDto.isActive,
        }),
        ...(updateDto.expiresAt !== undefined && {
          expiresAt: updateDto.expiresAt,
        }),
      },
    });

    this.logger.log(`API key updated: ${keyId}`);
    return this.mapApiKeyToResponseDto(updatedApiKey);
  }

  /**
   * Delete (revoke) API key
   */
  async deleteApiKey(
    brandId: string,
    keyId: string,
    keycloakId: string,
  ): Promise<void> {
    const apiKey = await this.prisma.brandApiKey.findFirst({
      where: {
        id: keyId,
        brandId,
        deletedAt: null,
      },
    });

    if (!apiKey) {
      throw new NotFoundException(
        `API key with ID ${keyId} not found for brand ${brandId}`,
      );
    }

    await this.checkBrandAccess(brandId, keycloakId);

    await this.prisma.brandApiKey.update({
      where: { id: keyId },
      data: { deletedAt: new Date(), isActive: false },
    });

    this.logger.log(`API key revoked: ${keyId}`);
  }

  /**
   * Validate API key and return brand ID
   */
  async validateApiKey(apiKey: string): Promise<{
    brandId: string;
    permissions: string[];
    apiKeyId: string;
  } | null> {
    const keyHash = this.hashApiKey(apiKey);
    const apiKeyRecord = await this.prisma.brandApiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKeyRecord) {
      return null;
    }

    // Check if key is active and not deleted
    if (!apiKeyRecord.isActive || apiKeyRecord.deletedAt) {
      return null;
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.brandApiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      brandId: apiKeyRecord.brandId,
      permissions: apiKeyRecord.permissions,
      apiKeyId: apiKeyRecord.id,
    };
  }

  /**
   * Map Prisma BrandApiKey to response DTO
   */
  private mapApiKeyToResponseDto(apiKey: {
    id: string;
    brandId: string;
    name: string;
    prefix: string;
    permissions: string[];
    isActive: boolean;
    lastUsedAt?: Date | null;
    expiresAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ApiKeyResponseDto {
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      permissions: apiKey.permissions,
      isActive: apiKey.isActive,
      lastUsedAt: apiKey.lastUsedAt || undefined,
      expiresAt: apiKey.expiresAt || undefined,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }

  /**
   * Delete document
   */
  async deleteDocument(brandId: string, documentId: string): Promise<void> {
    const document = await this.prisma.brandDocument.findFirst({
      where: {
        id: documentId,
        brandId,
      },
    });

    if (!document) {
      throw new NotFoundException(
        `Document with ID ${documentId} not found for brand ${brandId}`,
      );
    }

    // Extract path from URL for deletion
    // URL format: http://localhost:9000/brands/{brandId}/documents/{filename}
    // We need to extract: brands/{brandId}/documents/{filename}
    try {
      const url = new URL(document.fileUrl);
      const pathParts = url.pathname.split('/').filter((p) => p);
      const brandsIndex = pathParts.findIndex((p) => p === 'brands');
      if (brandsIndex !== -1) {
        const filePath = pathParts.slice(brandsIndex + 1).join('/');
        await this.storageService.deleteFile(
          this.storageService.getBuckets().brands,
          filePath,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete file from storage: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await this.prisma.brandDocument.delete({
      where: { id: documentId },
    });

    this.logger.log(`Document deleted: ${documentId}`);
  }

  /**
   * Map Prisma BrandDocument to response DTO
   */
  private mapDocumentToResponseDto(document: {
    id: string;
    brandId: string;
    type: DocumentType;
    name: string;
    fileUrl: string;
    fileType?: string | null;
    fileSize?: number | null;
    uploadedAt: Date;
    verifiedAt?: Date | null;
    verifiedBy?: string | null;
    isVerified: boolean;
    verificationNote?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): DocumentResponseDto {
    return {
      id: document.id,
      type: document.type,
      name: document.name,
      fileUrl: document.fileUrl,
      fileType: document.fileType || undefined,
      fileSize: document.fileSize || undefined,
      uploadedAt: document.uploadedAt,
      verifiedAt: document.verifiedAt || undefined,
      verifiedBy: document.verifiedBy || undefined,
      isVerified: document.isVerified,
      verificationNote: document.verificationNote || undefined,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Map Prisma model to response DTO
   */
  private mapToResponseDto(brand: {
    id: string;
    name: string;
    description?: string | null;
    logo?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    backgroundColor?: string | null;
    textColor?: string | null;
    fontFamily?: string | null;
    favicon?: string | null;
    bannerImage?: string | null;
    backgroundImage?: string | null;
    website?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    status: BrandStatus;
    isVerified: boolean;
    verifiedAt?: Date | null;
    settings?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): BrandResponseDto {
    return {
      id: brand.id,
      name: brand.name,
      description: brand.description || undefined,
      logo: brand.logo || undefined,
      primaryColor: brand.primaryColor || undefined,
      secondaryColor: brand.secondaryColor || undefined,
      accentColor: brand.accentColor || undefined,
      backgroundColor: brand.backgroundColor || undefined,
      textColor: brand.textColor || undefined,
      fontFamily: brand.fontFamily || undefined,
      favicon: brand.favicon || undefined,
      bannerImage: brand.bannerImage || undefined,
      backgroundImage: brand.backgroundImage || undefined,
      website: brand.website || undefined,
      phone: brand.phone || undefined,
      email: brand.email || undefined,
      address: brand.address || undefined,
      status: brand.status,
      isVerified: brand.isVerified,
      verifiedAt: brand.verifiedAt || undefined,
      settings: brand.settings as Record<string, unknown> | undefined,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }
}
