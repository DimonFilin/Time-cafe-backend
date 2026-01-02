import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Public } from 'nest-keycloak-connect';
import { StorageService } from './storage.service';
import { FileValidator } from './utils/file-validator';

@ApiTags('Storage Test')
@Controller('storage-test')
@Public()
export class StorageTestController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload/:bucket')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Тестовая загрузка файла' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadFile(
    @Param('bucket') bucket: string,
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
    if (!file) {
      throw new Error('Файл не предоставлен');
    }

    // Validate file (size check, but not type for tests)
    FileValidator.validateFileSize(file, 10 * 1024 * 1024); // 10MB max

    const path = `test/${Date.now()}-${file.originalname || 'file'}`;
    const result = await this.storageService.uploadFile(bucket, path, file);

    return {
      message: 'Файл успешно загружен',
      result,
    };
  }

  @Get('url/:bucket/*')
  @ApiOperation({ summary: 'Получение URL файла' })
  async getFileUrl(
    @Param('bucket') bucket: string,
    @Param() params: Record<string, string>,
  ) {
    // Get path from wildcard parameter (may be '0' or another key)
    const path =
      params['0'] || Object.values(params).find((v) => v && v !== bucket);
    if (!path) {
      throw new Error('Path is required');
    }
    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      decodedPath = path;
    }
    const url = await this.storageService.getFileUrl(bucket, decodedPath);
    return { url };
  }

  @Get('exists/:bucket/*')
  @ApiOperation({ summary: 'Проверка существования файла' })
  async fileExists(
    @Param('bucket') bucket: string,
    @Param() params: Record<string, string>,
  ) {
    const path =
      params['0'] || Object.values(params).find((v) => v && v !== bucket);
    if (!path) {
      throw new Error('Path is required');
    }
    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      decodedPath = path;
    }
    const exists = await this.storageService.fileExists(bucket, decodedPath);
    return { exists };
  }

  @Get('metadata/:bucket/*')
  @ApiOperation({ summary: 'Получение метаданных файла' })
  async getFileMetadata(
    @Param('bucket') bucket: string,
    @Param() params: Record<string, string>,
  ) {
    const path =
      params['0'] || Object.values(params).find((v) => v && v !== bucket);
    if (!path) {
      throw new Error('Path is required');
    }
    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      decodedPath = path;
    }
    const metadata = await this.storageService.getFileMetadata(
      bucket,
      decodedPath,
    );
    return metadata;
  }

  @Get('list/:bucket')
  @ApiOperation({ summary: 'Список файлов в bucket' })
  async listFiles(@Param('bucket') bucket: string) {
    const files = await this.storageService.listFiles(bucket);
    return { files, count: files.length };
  }

  @Delete('delete/:bucket/*')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удаление файла' })
  async deleteFile(
    @Param('bucket') bucket: string,
    @Param() params: Record<string, string>,
  ) {
    const path =
      params['0'] || Object.values(params).find((v) => v && v !== bucket);
    if (!path) {
      throw new Error('Path is required');
    }
    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch {
      decodedPath = path;
    }
    await this.storageService.deleteFile(bucket, decodedPath);
    return { message: 'Файл успешно удален' };
  }
}
