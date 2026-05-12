import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import type { Response } from 'express';
import { StorageService } from './storage.service';
import { WorkersService } from '../workers/workers.service';

@ApiTags('Media files')
@Controller('media-files')
export class MediaFilesController {
  constructor(
    private readonly storageService: StorageService,
    private readonly workersService: WorkersService,
  ) {}

  @Get(':bucket/*')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Отдать файл из MinIO по bucket/key (для админки: Nest ходит на STORAGE_ENDPOINT, без presigned в браузере)',
  })
  async streamFile(
    @Param('bucket') bucket: string,
    @Param() params: Record<string, string>,
    @Request() req: { user?: { sub?: string } },
    @Res({ passthrough: false }) res: Response,
  ) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) {
      throw new ForbiddenException('Only worker accounts can load media-files');
    }

    const buckets = this.storageService.getBuckets();
    if (!Object.values(buckets).includes(bucket)) {
      throw new BadRequestException(`Invalid bucket: ${bucket}`);
    }

    let path: string | undefined = params['0'];
    if (!path) {
      const pathValue = Object.entries(params).find(
        ([k, v]) => k !== 'bucket' && v && v !== bucket,
      );
      path = pathValue ? pathValue[1] : undefined;
    }
    if (!path) {
      throw new BadRequestException('Path is required');
    }

    const pathString = Array.isArray(path) ? path.join('/') : String(path);

    let decodedPath = pathString;
    try {
      decodedPath = decodeURIComponent(pathString);
    } catch {
      decodedPath = pathString;
    }

    if (decodedPath.startsWith(`${bucket}/`)) {
      decodedPath = decodedPath.substring(bucket.length + 1);
    } else if (decodedPath.startsWith(`${bucket},`)) {
      decodedPath = decodedPath.substring(bucket.length + 1).replace(/,/g, '/');
    }

    const { data, contentType } = await this.storageService.getObjectBytes(
      bucket,
      decodedPath,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=120');
    res.send(data);
  }
}
