import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { StorageService } from './storage.service';
import { AdminFileListResponseDto } from './dto/admin-file-list-response.dto';
import { WorkersService } from '../workers/workers.service';
import { WorkerRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FileValidator } from './utils/file-validator';

@ApiTags('Admin Storage')
@Controller('admin/storage')
export class AdminStorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly workersService: WorkersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('buckets')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get list of available buckets (SYSTEM_ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of buckets',
    schema: {
      type: 'object',
      properties: {
        buckets: {
          type: 'object',
          properties: {
            brands: { type: 'string' },
            cafes: { type: 'string' },
            users: { type: 'string' },
            public: { type: 'string' },
          },
        },
      },
    },
  })
  async getBuckets(@Request() req: { user?: { sub?: string } }) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new BadRequestException('Only SYSTEM_ADMIN can access storage');
    }

    return { buckets: this.storageService.getBuckets() };
  }

  @Get('files/:bucket')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get list of files in bucket with relationships (SYSTEM_ADMIN only)',
  })
  @ApiQuery({
    name: 'prefix',
    required: false,
    description: 'Filter files by prefix',
  })
  @ApiResponse({
    status: 200,
    description: 'List of files with relationships',
    type: AdminFileListResponseDto,
  })
  async listFiles(
    @Param('bucket') bucket: string,
    @Query('prefix') prefix?: string,
    @Request() req: { user?: { sub?: string } } = {},
  ): Promise<AdminFileListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new BadRequestException('Only SYSTEM_ADMIN can access storage');
    }

    const buckets = this.storageService.getBuckets();
    if (!Object.values(buckets).includes(bucket)) {
      throw new BadRequestException(`Invalid bucket: ${bucket}`);
    }

    const files = await this.storageService.listFiles(bucket, prefix);
    const items = await Promise.all(
      files.map(async (path) => {
        const metadata = await this.storageService.getFileMetadata(
          bucket,
          path,
        );
        const relationship = await this.getFileRelationship(bucket, path);

        return {
          path,
          bucket,
          size: metadata.size,
          mimeType: metadata.mimeType,
          lastModified: metadata.lastModified,
          ...relationship,
        };
      }),
    );

    return {
      items,
      total: items.length,
      bucket,
      prefix: prefix || undefined,
    };
  }

  @Get('files/:bucket/*')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get file URL for download (SYSTEM_ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'File URL',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  async getFileUrl(
    @Param('bucket') bucket: string,
    @Param() params: Record<string, string>,
    @Request() req: { user?: { sub?: string } } = {},
  ) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new BadRequestException('Only SYSTEM_ADMIN can access storage');
    }

    // Extract path from wildcard parameter
    // NestJS stores wildcard path segments in params['0'] or as a separate key
    let path: string | undefined = params['0'];
    if (!path) {
      // Try to find path in other params (excluding bucket)
      const pathValue = Object.entries(params).find(
        ([key, value]) => key !== 'bucket' && value && value !== bucket,
      );
      path = pathValue ? pathValue[1] : undefined;
    }

    if (!path) {
      throw new BadRequestException('Path is required');
    }

    // Handle case where path might be an array (shouldn't happen, but just in case)
    let pathString: string;
    if (Array.isArray(path)) {
      pathString = path.join('/');
    } else {
      pathString = String(path);
    }

    // Decode URL-encoded path
    let decodedPath = pathString;
    try {
      decodedPath = decodeURIComponent(pathString);
    } catch {
      decodedPath = pathString;
    }

    // Remove bucket name from path if it's included (path should not contain bucket)
    // Path format should be: brand-id/documents/file.pdf (not brands/brand-id/...)
    if (decodedPath.startsWith(`${bucket}/`)) {
      decodedPath = decodedPath.substring(bucket.length + 1);
    } else if (decodedPath.startsWith(`${bucket},`)) {
      // Handle comma-separated format (shouldn't happen, but just in case)
      decodedPath = decodedPath.substring(bucket.length + 1).replace(/,/g, '/');
    }

    console.log('[AdminStorageController] Get file URL:', {
      bucket,
      originalPath: path,
      pathString,
      decodedPath,
      finalPath: decodedPath,
    });

    const url = await this.storageService.getFileUrl(bucket, decodedPath, 3600);

    console.log('[AdminStorageController] Generated URL:', url);

    return { url };
  }

  @Get('download/:bucket/*')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Download file directly (SYSTEM_ADMIN only)',
  })
  async downloadFile(
    @Param('bucket') bucket: string,
    @Param() params: Record<string, string>,
    @Res() res: Response,
    @Request() req: { user?: { sub?: string } } = {},
  ) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new BadRequestException('Only SYSTEM_ADMIN can access storage');
    }

    const path =
      params['0'] || Object.values(params).find((v) => v && v !== bucket);
    if (!path) {
      throw new BadRequestException('Path is required');
    }

    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      decodedPath = path;
    }

    const url = await this.storageService.getFileUrl(bucket, decodedPath, 3600);
    res.redirect(url);
  }

  @Post('upload/:bucket')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload file to bucket (SYSTEM_ADMIN only)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path in bucket (e.g., test/file.pdf)',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
      },
      required: ['path', 'file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
  })
  async uploadFile(
    @Param('bucket') bucket: string,
    @Body() body: { path?: string },
    @Request() req: { user?: { sub?: string } } = {},
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          size: number;
          originalname?: string;
        }
      | undefined,
  ) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new BadRequestException('Only SYSTEM_ADMIN can access storage');
    }

    const buckets = this.storageService.getBuckets();
    if (!Object.values(buckets).includes(bucket)) {
      throw new BadRequestException(`Invalid bucket: ${bucket}`);
    }

    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!body.path) {
      throw new BadRequestException('Path is required');
    }

    // Validate file size (max 50MB for admin uploads)
    FileValidator.validateFileSize(file, 50 * 1024 * 1024);

    // Remove bucket name from path if it's included (path should not contain bucket)
    // Path format should be: brand-id/documents/file.pdf (not brands/brand-id/...)
    let filePath = body.path;
    if (filePath.startsWith(`${bucket}/`)) {
      filePath = filePath.substring(bucket.length + 1);
    } else if (filePath.startsWith(`${bucket},`)) {
      // Handle comma-separated format (shouldn't happen, but just in case)
      filePath = filePath.substring(bucket.length + 1).replace(/,/g, '/');
    }

    console.log('[AdminStorageController] Upload file:', {
      bucket,
      originalPath: body.path,
      finalPath: filePath,
      fileName: file.originalname,
    });

    const uploadResult = await this.storageService.uploadFile(
      bucket,
      filePath,
      file,
    );

    console.log('[AdminStorageController] Upload result:', {
      bucket: uploadResult.bucket,
      path: uploadResult.path,
      url: uploadResult.url,
    });

    // Verify file was actually uploaded by checking if it exists
    const fileExists = await this.storageService.fileExists(
      bucket,
      uploadResult.path,
    );
    console.log('[AdminStorageController] File exists check:', {
      bucket,
      path: uploadResult.path,
      exists: fileExists,
    });

    if (!fileExists) {
      throw new BadRequestException(
        `File was uploaded but cannot be found: ${bucket}/${uploadResult.path}`,
      );
    }

    return {
      message: 'File uploaded successfully',
      result: uploadResult,
    };
  }

  @Delete('files/:bucket/*')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete file (SYSTEM_ADMIN only)',
  })
  @ApiResponse({
    status: 204,
    description: 'File deleted successfully',
  })
  async deleteFile(
    @Param('bucket') bucket: string,
    @Param() params: Record<string, string>,
    @Request() req: { user?: { sub?: string } } = {},
  ) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new BadRequestException('Only SYSTEM_ADMIN can access storage');
    }

    // Extract path from wildcard parameter
    let path: string | undefined = params['0'];
    if (!path) {
      const pathValue = Object.entries(params).find(
        ([key, value]) => key !== 'bucket' && value && value !== bucket,
      );
      path = pathValue ? pathValue[1] : undefined;
    }

    if (!path) {
      throw new BadRequestException('Path is required');
    }

    // Handle case where path might be an array (shouldn't happen, but just in case)
    let pathString: string;
    if (Array.isArray(path)) {
      pathString = path.join('/');
    } else {
      pathString = String(path);
    }

    // Decode URL-encoded path
    let decodedPath = pathString;
    try {
      decodedPath = decodeURIComponent(pathString);
    } catch {
      decodedPath = pathString;
    }

    // Remove bucket name from path if it's included
    if (decodedPath.startsWith(`${bucket}/`)) {
      decodedPath = decodedPath.substring(bucket.length + 1);
    } else if (decodedPath.startsWith(`${bucket},`)) {
      decodedPath = decodedPath.substring(bucket.length + 1).replace(/,/g, '/');
    }

    console.log('[AdminStorageController] Delete file:', {
      bucket,
      originalPath: path,
      pathString,
      decodedPath,
      finalPath: decodedPath,
    });

    await this.storageService.deleteFile(bucket, decodedPath);
    return { message: 'File deleted successfully' };
  }

  private async getFileRelationship(
    bucket: string,
    path: string,
  ): Promise<{
    entityType?: string;
    entityId?: string;
    category?: string;
    relationship?: string;
  }> {
    const buckets = this.storageService.getBuckets();

    if (bucket === buckets.brands) {
      // Path format: {brandId}/{category}/{filename} (without bucket prefix)
      // But also handle legacy format with bucket prefix
      let normalizedPath = path;
      if (path.startsWith('brands/')) {
        normalizedPath = path.substring(7); // Remove 'brands/' prefix
      }
      const match = normalizedPath.match(/^([^/]+)\/([^/]+)\/(.+)$/);
      if (match) {
        const [, brandId, category, filename] = match;
        const brand = await this.prisma.brand.findUnique({
          where: { id: brandId },
          select: { name: true },
        });

        let relationship = '';
        if (category === 'documents') {
          const doc = await this.prisma.brandDocument.findFirst({
            where: {
              fileUrl: { contains: filename },
              brandId,
            },
            select: { name: true, type: true },
          });
          relationship = doc
            ? `Документ бренда "${brand?.name || brandId}": ${doc.name} (${doc.type})`
            : `Документ бренда "${brand?.name || brandId}"`;
        } else if (category === 'logo') {
          relationship = `Логотип бренда "${brand?.name || brandId}"`;
        } else if (category === 'banner') {
          relationship = `Баннер бренда "${brand?.name || brandId}"`;
        } else {
          relationship = `Файл бренда "${brand?.name || brandId}"`;
        }

        return {
          entityType: 'brand',
          entityId: brandId,
          category,
          relationship,
        };
      }
    } else if (bucket === buckets.cafes) {
      // Path format: {cafeId}/{category}/{filename} (without bucket prefix)
      let normalizedPath = path;
      if (path.startsWith('cafes/')) {
        normalizedPath = path.substring(6); // Remove 'cafes/' prefix
      }
      const match = normalizedPath.match(/^([^/]+)\/([^/]+)\/(.+)$/);
      if (match) {
        const [, cafeId, category] = match;
        const cafe = await this.prisma.cafe.findUnique({
          where: { id: cafeId },
          select: { name: true },
        });

        let relationship = '';
        if (category === 'photos') {
          relationship = `Фото кафе "${cafe?.name || cafeId}"`;
        } else {
          relationship = `Файл кафе "${cafe?.name || cafeId}"`;
        }

        return {
          entityType: 'cafe',
          entityId: cafeId,
          category,
          relationship,
        };
      }
    } else if (bucket === buckets.users) {
      // Path format: {userId}/{category}/{filename} (without bucket prefix)
      let normalizedPath = path;
      if (path.startsWith('users/')) {
        normalizedPath = path.substring(6); // Remove 'users/' prefix
      }
      const match = normalizedPath.match(/^([^/]+)\/([^/]+)\/(.+)$/);
      if (match) {
        const [, userId] = match;
        return {
          entityType: 'user',
          entityId: userId,
          category: 'profile',
          relationship: `Файл пользователя ${userId}`,
        };
      }
    }

    return {};
  }
}
