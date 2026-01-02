import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private s3Client: S3Client;
  private readonly buckets: {
    brands: string;
    cafes: string;
    users: string;
    public: string;
  };

  constructor(private configService: ConfigService) {
    const endpoint =
      this.configService.get<string>('STORAGE_ENDPOINT') ||
      'http://localhost:9000';
    const accessKey =
      this.configService.get<string>('STORAGE_ACCESS_KEY') || 'minioadmin';
    const secretKey =
      this.configService.get<string>('STORAGE_SECRET_KEY') || 'minioadmin';
    const region =
      this.configService.get<string>('STORAGE_REGION') || 'us-east-1';
    const useSSL = this.configService.get<boolean>('STORAGE_USE_SSL', false);

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO
      ...(useSSL ? {} : { tls: false }),
    });

    this.buckets = {
      brands: 'brands',
      cafes: 'cafes',
      users: 'users',
      public: 'public',
    };
  }

  async onModuleInit(): Promise<void> {
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
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: metadata,
      });

      const response = await this.s3Client.send(command);

      const endpoint =
        this.configService.get<string>('STORAGE_ENDPOINT') ||
        'http://localhost:9000';
      // Encode path for URL
      const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
      const url = `${endpoint}/${bucket}/${encodedPath}`;

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
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: path,
      });

      // Use signed URL for all files (MinIO requires signature for access)
      // To make bucket public, configure it through MinIO policies
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Get file URL error: ${errorMessage}`, errorStack);
      throw new BadRequestException(`Failed to get file URL: ${errorMessage}`);
    }
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
}
