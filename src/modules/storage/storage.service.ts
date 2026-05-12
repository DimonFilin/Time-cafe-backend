import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { networkInterfaces } from 'node:os';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FileUploadResultDto } from './dto/file-upload-result.dto';
import { FileMetadataDto } from './dto/file-metadata.dto';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  /** S3 API (Put/Head/…) — адрес, с которого Nest реально ходит в MinIO. */
  private s3Client: S3Client;
  /** Подпись presigned GetObject — хост в URL должен открываться в браузере/на телефоне (SigV4 привязан к host). */
  private s3SigningClient: S3Client;
  /** Тот же origin, что в presigned URL (для DTO upload без расхождения с getFileUrl). */
  private readonly signingEndpointUrl: string;
  private readonly s3Config: {
    accessKey: string;
    secretKey: string;
    region: string;
    useSSL: boolean;
  };
  private readonly buckets: {
    brands: string;
    cafes: string;
    users: string;
    public: string;
  };

  constructor(private configService: ConfigService) {
    const internalEndpoint = this.normalizeS3Endpoint(
      this.configService.get<string>('STORAGE_ENDPOINT') ||
        'http://localhost:9000',
    );
    const accessKey =
      this.configService.get<string>('STORAGE_ACCESS_KEY') || 'minioadmin';
    const secretKey =
      this.configService.get<string>('STORAGE_SECRET_KEY') || 'minioadmin';
    const region =
      this.configService.get<string>('STORAGE_REGION') || 'us-east-1';
    const useSSL = this.configService.get<boolean>('STORAGE_USE_SSL', false);

    this.s3Config = { accessKey, secretKey, region, useSSL };

    this.s3Client = this.createS3Client(internalEndpoint);

    this.signingEndpointUrl = this.resolveSigningEndpoint(internalEndpoint);
    this.s3SigningClient =
      this.signingEndpointUrl === internalEndpoint
        ? this.s3Client
        : this.createS3Client(this.signingEndpointUrl);

    if (this.signingEndpointUrl !== internalEndpoint) {
      this.logger.log(
        `Presigned URLs use ${this.signingEndpointUrl} (STORAGE_ENDPOINT=${internalEndpoint} for server S3 calls)`,
      );
    }

    this.buckets = {
      brands: 'brands',
      cafes: 'cafes',
      users: 'users',
      public: 'public',
    };
  }

  private normalizeS3Endpoint(raw: string): string {
    const t = String(raw || '')
      .trim()
      .replace(/\/+$/, '');
    if (!t) return 'http://localhost:9000';
    if (!/^https?:\/\//i.test(t)) {
      return `http://${t}`;
    }
    return t;
  }

  /** Непетлевой частный IPv4 из URL (для выравнивания presigned MinIO с LAN-админкой). */
  private tryPrivateHostFromUrl(raw?: string | null): string | null {
    const t = String(raw ?? '').trim();
    if (!t) return null;
    try {
      const u = new URL(/^https?:\/\//i.test(t) ? t : `http://${t}`);
      const h = u.hostname.toLowerCase();
      if (h === 'localhost' || h === '127.0.0.1') return null;
      if (/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(h)) return h;
    } catch {
      return null;
    }
    return null;
  }

  private listLanIPv4Addresses(): string[] {
    const nets = networkInterfaces();
    const out: string[] = [];
    for (const info of Object.values(nets).flat()) {
      if (
        info &&
        info.family === 'IPv4' &&
        !info.internal &&
        /^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(info.address)
      ) {
        out.push(info.address);
      }
    }
    return [...new Set(out)].sort();
  }

  /**
   * При нескольких NIC (Wi‑Fi, Hyper‑V, VirtualBox…) «первая» LAN IP часто не та, что у телефона.
   * Задайте STORAGE_PUBLIC_ENDPOINT или STORAGE_LAN_PREFER_PREFIX (например 192.168.35).
   */
  private pickLanIPv4(): string | null {
    const list = this.listLanIPv4Addresses();
    if (!list.length) return null;
    const prefer = this.configService
      .get<string>('STORAGE_LAN_PREFER_PREFIX')
      ?.trim();
    if (prefer) {
      const hit = list.find((a) => a.startsWith(prefer));
      if (hit) return hit;
    }
    return list[0] ?? null;
  }

  /**
   * Endpoint, который попадёт в presigned URL (Host в подписи).
   * Должен совпадать с тем, куда клиенты реально ходят за файлами.
   */
  private resolveSigningEndpoint(internal: string): string {
    const explicit =
      this.configService.get<string>('STORAGE_PUBLIC_ENDPOINT')?.trim() ||
      this.configService.get<string>('BACKEND_FILE_SYSTEM_URL')?.trim() ||
      this.configService.get<string>('BACKEND_FILE_SYSTEM')?.trim();
    if (explicit) {
      return this.normalizeS3Endpoint(explicit);
    }

    if (/localhost|127\.0\.0\.1/i.test(internal)) {
      try {
        const parsed = new URL(internal);
        const port = parsed.port || '9000';
        const proto = parsed.protocol || 'http:';

        const feHost = this.tryPrivateHostFromUrl(
          this.configService.get<string>('FRONTEND_URL'),
        );
        if (feHost) {
          return `${proto}//${feHost}:${port}`;
        }

        const lan = this.pickLanIPv4();
        if (lan) {
          return `${proto}//${lan}:${port}`;
        }
      } catch {
        // ignore
      }
    }

    return internal;
  }

  private getPublicFileSystemBase(): string {
    return this.signingEndpointUrl;
  }

  private createS3Client(endpoint: string) {
    return new S3Client({
      endpoint,
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKey,
        secretAccessKey: this.s3Config.secretKey,
      },
      forcePathStyle: true,
      ...(this.s3Config.useSSL ? {} : { tls: false }),
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(
      `Presigned / public file URL base: ${this.signingEndpointUrl}`,
    );
    // Create buckets on initialization if they don't exist
    await this.ensureBucketsExist();
  }

  /**
   * Create buckets if they don't exist
   */
  private async ensureBucketsExist(): Promise<void> {
    const bucketNames = Object.values(this.buckets);

    for (const bucketName of bucketNames) {
      try {
        // Check if bucket exists
        const headCommand = new HeadBucketCommand({ Bucket: bucketName });
        await this.s3Client.send(headCommand);
        this.logger.log(`Bucket ${bucketName} already exists`);
      } catch {
        // Bucket doesn't exist, create it
        try {
          const createCommand = new CreateBucketCommand({ Bucket: bucketName });
          await this.s3Client.send(createCommand);
          this.logger.log(`Bucket ${bucketName} created`);
        } catch (createError: unknown) {
          const errorMessage =
            createError instanceof Error
              ? createError.message
              : String(createError);
          // Ignore "BucketAlreadyExists" or "BucketAlreadyOwnedByYou" errors
          if (
            errorMessage.includes('BucketAlreadyExists') ||
            errorMessage.includes('BucketAlreadyOwnedByYou')
          ) {
            this.logger.log(
              `Bucket ${bucketName} already exists (created by another process)`,
            );
          } else {
            this.logger.warn(
              `Failed to create bucket ${bucketName}: ${errorMessage}. Will be created automatically on first upload`,
            );
          }
        }
      }
    }
  }

  /**
   * Upload file
   */
  async uploadFile(
    bucket: string,
    path: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      size: number;
      originalname?: string;
    },
    metadata?: Record<string, string>,
  ): Promise<FileUploadResultDto> {
    try {
      this.logger.log(
        `Uploading file to ${bucket}/${path} (size: ${file.size} bytes)`,
      );

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: metadata,
      });

      const response = await this.s3Client.send(command);

      this.logger.log(
        `File uploaded successfully: ${bucket}/${path}, ETag: ${response.ETag}`,
      );

      const fileSystemBase = this.getPublicFileSystemBase();
      // Encode path for URL
      const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
      const url = `${fileSystemBase}/${bucket}/${encodedPath}`;

      return {
        url,
        path,
        bucket,
        size: file.size,
        mimeType: file.mimetype,
        etag: response.ETag || '',
        uploadedAt: new Date(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`File upload error: ${errorMessage}`, errorStack);
      throw new BadRequestException(`Failed to upload file: ${errorMessage}`);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: path,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted: ${bucket}/${path}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`File deletion error: ${errorMessage}`, errorStack);
      throw new BadRequestException(`Failed to delete file: ${errorMessage}`);
    }
  }

  /**
   * Get file URL (with signature for private files)
   */
  async getFileUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      this.logger.log(`Getting file URL for ${bucket}/${path}`);

      // First check if file exists
      const exists = await this.fileExists(bucket, path);
      if (!exists) {
        this.logger.warn(`File not found: ${bucket}/${path}`);
        throw new NotFoundException(`File not found: ${bucket}/${path}`);
      }

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: path,
      });

      // Use signed URL for all files (MinIO requires signature for access)
      // To make bucket public, configure it through MinIO policies
      const url = await getSignedUrl(this.s3SigningClient, command, {
        expiresIn,
      });

      this.logger.log(`Generated signed URL for ${bucket}/${path}`);

      return url;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Get file URL error: ${errorMessage}`, errorStack);
      throw new BadRequestException(`Failed to get file URL: ${errorMessage}`);
    }
  }

  async getFileUrlForEndpoint(
    bucket: string,
    path: string,
    endpoint: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const exists = await this.fileExists(bucket, path);
    if (!exists) {
      throw new NotFoundException(`File not found: ${bucket}/${path}`);
    }

    const client = this.createS3Client(endpoint);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: path,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  /**
   * Check if file exists
   */
  async fileExists(bucket: string, path: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: path,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: unknown) {
      const awsError = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
        Code?: string;
      };
      // Check various "not found" error variants
      if (
        awsError?.name === 'NotFound' ||
        awsError?.name === 'NoSuchKey' ||
        awsError?.Code === 'NoSuchKey' ||
        awsError?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      // Log other errors for debugging
      this.logger.warn(
        `Error checking file existence ${bucket}/${path}: ${awsError?.name || 'Unknown'}, Code: ${awsError?.Code || 'N/A'}, Status: ${awsError?.$metadata?.httpStatusCode || 'N/A'}`,
      );
      // For other errors return false (file doesn't exist)
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    bucket: string,
    path: string,
  ): Promise<FileMetadataDto> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: path,
      });

      const response = await this.s3Client.send(command);

      if (!response.LastModified || !response.ContentLength || !response.ETag) {
        throw new NotFoundException(`File not found: ${bucket}/${path}`);
      }

      return {
        path,
        size: response.ContentLength,
        mimeType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified,
        etag: response.ETag,
      };
    } catch (error: unknown) {
      const awsError = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        awsError?.name === 'NotFound' ||
        awsError?.$metadata?.httpStatusCode === 404
      ) {
        throw new NotFoundException(`File not found: ${bucket}/${path}`);
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Get file metadata error: ${errorMessage}`, errorStack);
      throw new BadRequestException(
        `Failed to get file metadata: ${errorMessage}`,
      );
    }
  }

  /**
   * List files in bucket
   */
  async listFiles(bucket: string, prefix?: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);
      return (response.Contents || []).map((object) => object.Key || '');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`List files error: ${errorMessage}`, errorStack);
      throw new BadRequestException(`Failed to list files: ${errorMessage}`);
    }
  }

  /**
   * Copy file
   */
  async copyFile(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string,
  ): Promise<void> {
    try {
      // For MinIO CopySource must be in "bucket/key" format
      const command = new CopyObjectCommand({
        Bucket: destBucket,
        CopySource: `${sourceBucket}/${sourcePath}`,
        Key: destPath,
      });

      await this.s3Client.send(command);
      this.logger.log(
        `File copied: ${sourceBucket}/${sourcePath} -> ${destBucket}/${destPath}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`File copy error: ${errorMessage}`, errorStack);
      throw new BadRequestException(`Failed to copy file: ${errorMessage}`);
    }
  }

  /**
   * Get bucket names
   */
  getBuckets(): typeof this.buckets {
    return this.buckets;
  }

  /**
   * Байты объекта из MinIO по внутреннему S3-клиенту (без presigned URL).
   * Для отдачи файлов в админку через BFF, когда браузер на localhost не может ходить на LAN :9000.
   */
  async getObjectBytes(
    bucket: string,
    key: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    const exists = await this.fileExists(bucket, key);
    if (!exists) {
      throw new NotFoundException(`File not found: ${bucket}/${key}`);
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const out = await this.s3Client.send(command);
    const body = out.Body;
    if (!body) {
      throw new NotFoundException(`Empty body: ${bucket}/${key}`);
    }

    const arr = await body.transformToByteArray();
    return {
      data: Buffer.from(arr),
      contentType: out.ContentType || 'application/octet-stream',
    };
  }
}
