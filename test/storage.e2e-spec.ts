import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/modules/storage/storage.service';
import { FileUploadResultDto } from '../src/modules/storage/dto/file-upload-result.dto';
import { FileMetadataDto } from '../src/modules/storage/dto/file-metadata.dto';

interface UploadResponse {
  message: string;
  result: FileUploadResultDto;
}

interface FileUrlResponse {
  url: string;
}

interface FileExistsResponse {
  exists: boolean;
}

interface FileListResponse {
  files: string[];
  count: number;
}

describe('StorageService (e2e)', () => {
  let app: INestApplication;
  let storageService: StorageService;
  let uploadedFilePath: string;
  let uploadedFileBucket: string;
  const filesToCleanup: Array<{ bucket: string; path: string }> = [];

  beforeAll(async () => {
    // Устанавливаем переменные окружения для MinIO
    process.env.STORAGE_ENDPOINT =
      process.env.STORAGE_ENDPOINT || 'http://localhost:9000';
    process.env.STORAGE_ACCESS_KEY =
      process.env.STORAGE_ACCESS_KEY || 'minioadmin';
    process.env.STORAGE_SECRET_KEY =
      process.env.STORAGE_SECRET_KEY || 'minioadmin';
    process.env.STORAGE_REGION = process.env.STORAGE_REGION || 'us-east-1';
    process.env.STORAGE_USE_SSL = process.env.STORAGE_USE_SSL || 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    storageService = moduleFixture.get<StorageService>(StorageService);

    await app.init();
  });

  afterAll(async () => {
    // Очистка: удаляем все созданные файлы
    for (const file of filesToCleanup) {
      try {
        await storageService.deleteFile(file.bucket, file.path);
      } catch {
        // Ignore cleanup errors
      }
    }
    // Also delete file from old logic if it exists
    if (uploadedFilePath && uploadedFileBucket) {
      try {
        await storageService.deleteFile(uploadedFileBucket, uploadedFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
    await app.close();
  });

  describe('POST /storage-test/upload/:bucket', () => {
    it('должен загрузить файл в bucket', async () => {
      const bucket = 'public';
      const testFile = Buffer.from('test file content');
      const fileName = `test-${Date.now()}.txt`;

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/storage-test/upload/${bucket}`)
        .attach('file', testFile, fileName)
        .expect(200);

      const body = response.body as UploadResponse;
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('result');
      expect(body.result).toHaveProperty('url');
      expect(body.result).toHaveProperty('path');
      expect(body.result).toHaveProperty('bucket', bucket);
      expect(body.result).toHaveProperty('size');
      expect(body.result).toHaveProperty('mimeType');

      // Output link for verification
      console.log('\n=== UPLOADED FILE LINK ===');
      console.log('Bucket:', bucket);
      console.log('Path:', body.result.path);
      console.log('URL:', body.result.url);
      console.log('===========================\n');

      // Save for cleanup
      uploadedFilePath = body.result.path;
      uploadedFileBucket = bucket;
      filesToCleanup.push({ bucket, path: body.result.path });
    });

    it('должен загрузить изображение в bucket brands', async () => {
      const bucket = 'brands';
      // Создаем минимальное PNG изображение (1x1 пиксель)
      const pngHeader = Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
      ]);
      const fileName = `test-image-${Date.now()}.png`;

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/storage-test/upload/${bucket}`)
        .attach('file', pngHeader, fileName)
        .expect(200);

      const body = response.body as UploadResponse;
      expect(body.result).toHaveProperty('bucket', bucket);
      expect(body.result.mimeType).toContain('image');

      // Delete test file immediately
      if (body.result.path) {
        await storageService.deleteFile(bucket, body.result.path);
      }
    });

    it('должен вернуть ошибку при отсутствии файла', async () => {
      const bucket = 'public';

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/storage-test/upload/${bucket}`)
        .expect(500); // Server error, file not provided
    });
  });

  describe('GET /storage-test/exists/:bucket/:path', () => {
    it('должен проверить существование загруженного файла', async () => {
      // Сначала загружаем файл
      const bucket = 'public';
      const testFile = Buffer.from('test content for exists check');
      const fileName = `exists-test-${Date.now()}.txt`;

      const uploadResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/storage-test/upload/${bucket}`)
        .attach('file', testFile, fileName)
        .expect(200);

      const uploadBody = uploadResponse.body as UploadResponse;
      const filePath = uploadBody.result.path;
      expect(filePath).toBeTruthy();

      // Retry логика для проверки существования (MinIO eventual consistency)
      let exists = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        exists = await storageService.fileExists(bucket, filePath);
        if (exists) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(exists).toBe(true);

      // Также проверяем через HTTP endpoint
      const encodedPath = encodeURIComponent(filePath);
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/exists/${bucket}/${encodedPath}`)
        .expect(200);

      const body = response.body as FileExistsResponse;
      expect(body).toHaveProperty('exists', true);

      // Сохраняем для очистки
      filesToCleanup.push({ bucket, path: filePath });

      // Очистка
      await storageService.deleteFile(bucket, filePath);
    });

    it('должен вернуть false для несуществующего файла', async () => {
      const bucket = 'public';
      const nonExistentPath = 'non-existent-file-12345.txt';

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/exists/${bucket}/${nonExistentPath}`)
        .expect(200);

      const body = response.body as FileExistsResponse;
      expect(body).toHaveProperty('exists', false);
    });
  });

  describe('GET /storage-test/url/:bucket/:path', () => {
    it('должен получить URL загруженного файла', async () => {
      // Загружаем файл
      const bucket = 'public';
      const testFile = Buffer.from('test content for URL');
      const fileName = `url-test-${Date.now()}.txt`;

      const uploadResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/storage-test/upload/${bucket}`)
        .attach('file', testFile, fileName)
        .expect(200);

      const uploadBody = uploadResponse.body as UploadResponse;
      const filePath = uploadBody.result.path;

      // Retry логика для проверки существования перед получением URL
      let exists = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        exists = await storageService.fileExists(bucket, filePath);
        if (exists) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(exists).toBe(true);

      // Получаем URL (кодируем путь для URL)
      const encodedPath = encodeURIComponent(filePath);
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/url/${bucket}/${encodedPath}`)
        .expect(200);

      const body = response.body as FileUrlResponse;
      expect(body).toHaveProperty('url');
      expect(body.url).toBeTruthy();
      expect(typeof body.url).toBe('string');

      // Output link for verification
      console.log('\n=== UPLOADED FILE LINK (URL TEST) ===');
      console.log('Bucket:', bucket);
      console.log('Path:', filePath);
      console.log('URL:', body.url);
      console.log('=====================================\n');

      // Сохраняем для очистки
      filesToCleanup.push({ bucket, path: filePath });

      // Очистка
      await storageService.deleteFile(bucket, filePath);
    });
  });

  describe('GET /storage-test/metadata/:bucket/:path', () => {
    it('должен получить метаданные загруженного файла', async () => {
      // Загружаем файл
      const bucket = 'public';
      const testContent = 'test content for metadata';
      const testFile = Buffer.from(testContent);
      const fileName = `metadata-test-${Date.now()}.txt`;

      const uploadResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/storage-test/upload/${bucket}`)
        .attach('file', testFile, fileName)
        .expect(200);

      const uploadBody = uploadResponse.body as UploadResponse;
      const filePath = uploadBody.result.path;

      // Retry логика для проверки существования перед получением метаданных
      let exists = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        exists = await storageService.fileExists(bucket, filePath);
        if (exists) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(exists).toBe(true);

      // Получаем метаданные (кодируем путь для URL)
      const encodedPath = encodeURIComponent(filePath);
      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/metadata/${bucket}/${encodedPath}`)
        .expect(200);

      const body = response.body as FileMetadataDto;
      expect(body).toHaveProperty('path', filePath);
      expect(body).toHaveProperty('size');
      expect(body.size).toBe(testContent.length);
      expect(body).toHaveProperty('mimeType');
      expect(body).toHaveProperty('lastModified');
      expect(body).toHaveProperty('etag');

      // Сохраняем для очистки
      filesToCleanup.push({ bucket, path: filePath });

      // Очистка
      await storageService.deleteFile(bucket, filePath);
    });

    it('должен вернуть 404 для несуществующего файла', async () => {
      const bucket = 'public';
      const nonExistentPath = 'non-existent-file-12345.txt';

      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/metadata/${bucket}/${nonExistentPath}`)
        .expect(404);
    });
  });

  describe('GET /storage-test/list/:bucket', () => {
    it('должен получить список файлов в bucket', async () => {
      const bucket = 'public';

      const response = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/list/${bucket}`)
        .expect(200);

      const body = response.body as FileListResponse;
      expect(body).toHaveProperty('files');
      expect(body).toHaveProperty('count');
      expect(Array.isArray(body.files)).toBe(true);
      expect(typeof body.count).toBe('number');
    });
  });

  describe('DELETE /storage-test/delete/:bucket/:path', () => {
    it('должен удалить загруженный файл', async () => {
      // Загружаем файл
      const bucket = 'public';
      const testFile = Buffer.from('test content for deletion');
      const fileName = `delete-test-${Date.now()}.txt`;

      const uploadResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/storage-test/upload/${bucket}`)
        .attach('file', testFile, fileName)
        .expect(200);

      const uploadBody = uploadResponse.body as UploadResponse;
      const filePath = uploadBody.result.path;

      // Retry логика для проверки существования
      let existsBefore = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        existsBefore = await storageService.fileExists(bucket, filePath);
        if (existsBefore) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(existsBefore).toBe(true);

      // Delete file (encode path for URL)
      const encodedPath = encodeURIComponent(filePath);
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete(`/storage-test/delete/${bucket}/${encodedPath}`)
        .expect(204);

      // Проверяем, что файл удален
      const existsAfter = await storageService.fileExists(bucket, filePath);
      expect(existsAfter).toBe(false);
    });

    it('должен обработать удаление несуществующего файла', async () => {
      const bucket = 'public';
      const nonExistentPath = 'non-existent-file-12345.txt';

      // MinIO may not return error when deleting non-existent file
      // Just check that request doesn't fail
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete(`/storage-test/delete/${bucket}/${nonExistentPath}`)
        .expect(204);
    });
  });

  describe('Полный цикл: загрузка -> проверка -> получение -> удаление', () => {
    it('должен выполнить полный цикл работы с файлом', async () => {
      const bucket = 'public';
      const testContent = 'Full cycle test content';
      const testFile = Buffer.from(testContent);
      const fileName = `full-cycle-${Date.now()}.txt`;

      // 1. Загрузка
      const uploadResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .post(`/storage-test/upload/${bucket}`)
        .attach('file', testFile, fileName)
        .expect(200);

      const uploadBody = uploadResponse.body as UploadResponse;
      const filePath = uploadBody.result.path;
      expect(filePath).toBeTruthy();

      // 2. Проверка существования (retry логика для MinIO eventual consistency)
      let exists = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        exists = await storageService.fileExists(bucket, filePath);
        if (exists) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      expect(exists).toBe(true);

      // Кодируем путь для использования в URL
      const encodedPath = encodeURIComponent(filePath);

      // Also check via HTTP endpoint
      const existsResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/exists/${bucket}/${encodedPath}`)
        .expect(200);
      const existsBody = existsResponse.body as FileExistsResponse;
      expect(existsBody.exists).toBe(true);

      // 3. Get URL
      const urlResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/url/${bucket}/${encodedPath}`)
        .expect(200);
      const urlBody = urlResponse.body as FileUrlResponse;
      expect(urlBody.url).toBeTruthy();

      // Output link for verification
      console.log('\n=== FILE LINK (FULL CYCLE) ===');
      console.log('Bucket:', bucket);
      console.log('Path:', filePath);
      console.log('URL:', urlBody.url);
      console.log('==============================\n');

      // 4. Get metadata
      const metadataResponse = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get(`/storage-test/metadata/${bucket}/${encodedPath}`)
        .expect(200);
      const metadataBody = metadataResponse.body as FileMetadataDto;
      expect(metadataBody.size).toBe(testContent.length);

      // 5. Delete
      await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .delete(`/storage-test/delete/${bucket}/${encodedPath}`)
        .expect(204);

      // 6. Проверка, что файл удален (с небольшой задержкой)
      await new Promise((resolve) => setTimeout(resolve, 300));
      const existsAfterDelete = await storageService.fileExists(
        bucket,
        filePath,
      );
      expect(existsAfterDelete).toBe(false);
    });
  });
});
