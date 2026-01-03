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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { BrandResponseDto } from './dto/brand-response.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { UpdateCustomizationDto } from './dto/update-customization.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';
import { CreateApiKeyResponseDto } from './dto/create-api-key-response.dto';
import { RejectBrandDto } from './dto/reject-brand.dto';
import { SuspendBrandDto } from './dto/suspend-brand.dto';
import { BrandStatus } from '@prisma/client';
import { AuthGuard } from 'nest-keycloak-connect';
import { Public } from 'nest-keycloak-connect';
import { FileValidator } from '../storage/utils/file-validator';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @Public()
  @ApiOperation({
    summary: 'Create brand',
    description:
      'Create a new brand. Requires API key (X-API-Key header) or SYSTEM_ADMIN role. Currently accepts API key for future implementation.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description:
      'API key for brand creation (optional, for future implementation)',
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: 'Brand created',
    type: BrandResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid API key or missing SYSTEM_ADMIN role',
  })
  async create(
    @Body() createBrandDto: CreateBrandDto,
    // TODO: Add @Headers('x-api-key') apiKey parameter in step 7 for API key validation
  ): Promise<BrandResponseDto> {
    // TODO: Implement API key validation in step 7
    // For now, allow public access (will be restricted when API keys are implemented)
    // In production, this should check:
    // 1. Valid API key (X-API-Key header) OR
    // 2. SYSTEM_ADMIN role from authenticated user

    return this.brandsService.create(createBrandDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all brands' })
  @ApiResponse({
    status: 200,
    description: 'List of brands',
    type: [BrandResponseDto],
  })
  async findAll(
    @Query('status') status?: BrandStatus,
  ): Promise<BrandResponseDto[]> {
    return this.brandsService.findAll(status);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiResponse({
    status: 200,
    description: 'Brand details',
    type: BrandResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async findOne(@Param('id') id: string): Promise<BrandResponseDto> {
    return this.brandsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update brand' })
  @ApiResponse({
    status: 200,
    description: 'Brand updated',
    type: BrandResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async update(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    return this.brandsService.update(id, updateBrandDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete brand (soft delete)' })
  @ApiResponse({ status: 204, description: 'Brand deleted' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.brandsService.remove(id);
  }

  @Post(':id/documents')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload document for brand' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'REGISTRATION',
            'LICENSE',
            'CONTRACT',
            'TAX_CERTIFICATE',
            'BANK_STATEMENT',
            'OTHER',
          ],
          description: 'Document type',
        },
        name: {
          type: 'string',
          description: 'Document name',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (PDF, JPEG, PNG, max 10MB)',
        },
      },
      required: ['type', 'name', 'file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded successfully',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async uploadDocument(
    @Param('id') brandId: string,
    @Body() uploadDto: UploadDocumentDto,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          size: number;
          originalname?: string;
        }
      | undefined,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validate file using FileValidator
    FileValidator.validateDocument(file);

    return this.brandsService.uploadDocument(
      brandId,
      uploadDto.type,
      uploadDto.name,
      file,
    );
  }

  @Get(':id/documents')
  @Public()
  @ApiOperation({ summary: 'Get all documents for brand' })
  @ApiResponse({
    status: 200,
    description: 'List of documents',
    type: [DocumentResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async getBrandDocuments(
    @Param('id') brandId: string,
  ): Promise<DocumentResponseDto[]> {
    return this.brandsService.getBrandDocuments(brandId);
  }

  @Get(':id/documents/:docId')
  @Public()
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiResponse({
    status: 200,
    description: 'Document details',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocument(
    @Param('id') brandId: string,
    @Param('docId') documentId: string,
  ): Promise<DocumentResponseDto> {
    return this.brandsService.getDocument(brandId, documentId);
  }

  @Patch(':id/documents/:docId/verify')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify document (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Document verified successfully',
    type: DocumentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Document already verified' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async verifyDocument(
    @Param('id') brandId: string,
    @Param('docId') documentId: string,
    @Body() verifyDto: VerifyDocumentDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<DocumentResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.brandsService.verifyDocument(
      brandId,
      documentId,
      keycloakId,
      verifyDto.verificationNote,
    );
  }

  @Delete(':id/documents/:docId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete document' })
  @ApiResponse({ status: 204, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(
    @Param('id') brandId: string,
    @Param('docId') documentId: string,
  ): Promise<void> {
    return this.brandsService.deleteDocument(brandId, documentId);
  }

  @Post(':id/verify')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Verify and activate brand (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 201,
    description: 'Brand verified and activated successfully',
    type: BrandResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Brand already verified or missing required documents',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async verifyBrand(
    @Param('id') brandId: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<BrandResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.brandsService.verifyBrand(brandId, keycloakId);
  }

  @Patch(':id/customization')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update brand customization (BRAND_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Brand customization updated successfully',
    type: BrandResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async updateCustomization(
    @Param('id') brandId: string,
    @Body() customizationDto: UpdateCustomizationDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<BrandResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.brandsService.updateCustomization(
      brandId,
      keycloakId,
      customizationDto,
    );
  }

  @Post(':id/logo')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload brand logo (BRAND_ADMIN only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Logo image (JPEG, PNG, WEBP, max 2MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logo uploaded successfully',
    type: BrandResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async uploadLogo(
    @Param('id') brandId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          size: number;
          originalname?: string;
        }
      | undefined,
    @Request() req: { user?: { sub?: string } },
  ): Promise<BrandResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    if (!file) {
      throw new BadRequestException('File is required');
    }

    FileValidator.validateLogo(file);

    return this.brandsService.uploadLogo(brandId, keycloakId, file);
  }

  @Post(':id/banner')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload brand banner (BRAND_ADMIN only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Banner image (JPEG, PNG, WEBP, max 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Banner uploaded successfully',
    type: BrandResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async uploadBanner(
    @Param('id') brandId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          size: number;
          originalname?: string;
        }
      | undefined,
    @Request() req: { user?: { sub?: string } },
  ): Promise<BrandResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    if (!file) {
      throw new BadRequestException('File is required');
    }

    FileValidator.validateImage(file);

    return this.brandsService.uploadBanner(brandId, keycloakId, file);
  }

  @Post(':id/api-keys')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create API key for brand (BRAND_ADMIN only)' })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    type: CreateApiKeyResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async createApiKey(
    @Param('id') brandId: string,
    @Body() createDto: CreateApiKeyDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<CreateApiKeyResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const expiresAt = createDto.expiresAt
      ? new Date(createDto.expiresAt)
      : undefined;

    return this.brandsService.createApiKey(
      brandId,
      keycloakId,
      createDto.name,
      createDto.permissions,
      expiresAt,
    );
  }

  @Get(':id/api-keys')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all API keys for brand (BRAND_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'List of API keys',
    type: [ApiKeyResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async getBrandApiKeys(
    @Param('id') brandId: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<ApiKeyResponseDto[]> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.brandsService.getBrandApiKeys(brandId, keycloakId);
  }

  @Patch(':id/api-keys/:keyId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update API key (BRAND_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'API key updated successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async updateApiKey(
    @Param('id') brandId: string,
    @Param('keyId') keyId: string,
    @Body() updateDto: UpdateApiKeyDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<ApiKeyResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const expiresAt = updateDto.expiresAt
      ? new Date(updateDto.expiresAt)
      : updateDto.expiresAt === null
        ? null
        : undefined;

    return this.brandsService.updateApiKey(brandId, keyId, keycloakId, {
      name: updateDto.name,
      permissions: updateDto.permissions,
      isActive: updateDto.isActive,
      expiresAt,
    });
  }

  @Delete(':id/api-keys/:keyId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke API key (BRAND_ADMIN only)' })
  @ApiResponse({ status: 204, description: 'API key revoked' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - BRAND_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async deleteApiKey(
    @Param('id') brandId: string,
    @Param('keyId') keyId: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<void> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.brandsService.deleteApiKey(brandId, keyId, keycloakId);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject brand (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Brand rejected successfully',
    type: BrandResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Brand already rejected' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async rejectBrand(
    @Param('id') brandId: string,
    @Body() rejectDto: RejectBrandDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<BrandResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.brandsService.rejectBrand(
      brandId,
      keycloakId,
      rejectDto.reason,
    );
  }

  @Post(':id/suspend')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Suspend brand (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 201,
    description: 'Brand suspended successfully',
    type: BrandResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Brand already suspended' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async suspendBrand(
    @Param('id') brandId: string,
    @Body() suspendDto: SuspendBrandDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<BrandResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.brandsService.suspendBrand(
      brandId,
      keycloakId,
      suspendDto.reason,
    );
  }
}
