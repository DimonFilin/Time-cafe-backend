import { BadRequestException } from '@nestjs/common';

export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  isImage?: boolean;
  isDocument?: boolean;
}

interface FileLike {
  size: number;
  mimetype: string;
}

export class FileValidator {
  // Default limits
  private static readonly MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

  private static readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  private static readonly ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ];

  /**
   * Валидация размера файла
   */
  static validateFileSize(file: FileLike, maxSize: number): void {
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `Размер файла превышает максимально допустимый (${maxSizeMB}MB)`,
      );
    }
  }

  /**
   * Валидация MIME типа
   */
  static validateMimeType(file: FileLike, allowedTypes: string[]): void {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Недопустимый тип файла. Разрешенные типы: ${allowedTypes.join(', ')}`,
      );
    }
  }

  /**
   * Валидация изображения
   */
  static validateImage(file: FileLike, maxSize?: number): void {
    this.validateMimeType(file, this.ALLOWED_IMAGE_TYPES);
    this.validateFileSize(file, maxSize || this.MAX_IMAGE_SIZE);
  }

  /**
   * Валидация документа
   */
  static validateDocument(file: FileLike, maxSize?: number): void {
    this.validateMimeType(file, this.ALLOWED_DOCUMENT_TYPES);
    this.validateFileSize(file, maxSize || this.MAX_DOCUMENT_SIZE);
  }

  /**
   * Валидация логотипа
   */
  static validateLogo(file: FileLike): void {
    this.validateImage(file, this.MAX_LOGO_SIZE);
  }

  /**
   * Универсальная валидация файла
   */
  static validate(file: FileLike, options: FileValidationOptions): void {
    if (options.maxSize) {
      this.validateFileSize(file, options.maxSize);
    }

    if (options.allowedMimeTypes) {
      this.validateMimeType(file, options.allowedMimeTypes);
    }

    if (options.isImage) {
      this.validateImage(file, options.maxSize);
    }

    if (options.isDocument) {
      this.validateDocument(file, options.maxSize);
    }
  }
}
