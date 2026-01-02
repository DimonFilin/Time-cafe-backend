# Storage Service - MinIO Integration

## Обзор

StorageService - универсальный сервис для работы с файлами через MinIO (S3-совместимое хранилище).

## Настройка

### 1. Docker Compose

MinIO уже настроен в `docker-compose.yml`:

```yaml
minio:
  image: minio/minio:latest
  ports:
    - '9000:9000' # API endpoint
    - '9001:9001' # Web Console
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
```

### 2. Переменные окружения

Добавьте в `.env`:

```env
# MinIO Storage
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_REGION=us-east-1
STORAGE_USE_SSL=false
```

### 3. Запуск MinIO

```bash
docker-compose up -d minio
```

**Доступ:**

- API: http://localhost:9000
- Web Console: http://localhost:9001 (minioadmin/minioadmin)

## Структура хранения

### Buckets

- `brands` - Документы и медиа брендов
  - `{brandId}/documents/` - Юридические документы
  - `{brandId}/logo/` - Логотипы
  - `{brandId}/banners/` - Баннеры

- `cafes` - Фото кофеен (для будущего)
  - `{cafeId}/photos/`

- `users` - Аватары пользователей
  - `{userId}/avatar/`

- `public` - Публичные файлы
  - `temp/` - Временные файлы

## Использование

### Импорт модуля

```typescript
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [StorageModule],
  // ...
})
```

### Использование сервиса

```typescript
import { StorageService } from './modules/storage/storage.service';

constructor(private storageService: StorageService) {}

// Загрузка файла
const result = await this.storageService.uploadFile(
  'brands',
  `${brandId}/logo/logo.png`,
  file,
);

// Получение URL
const url = await this.storageService.getFileUrl('brands', `${brandId}/logo/logo.png`);

// Удаление
await this.storageService.deleteFile('brands', `${brandId}/logo/logo.png`);
```

## API методы

### `uploadFile(bucket, path, file, metadata?)`

Загружает файл в MinIO.

**Параметры:**

- `bucket: string` - Имя bucket
- `path: string` - Путь к файлу в bucket
- `file: Express.Multer.File` - Файл для загрузки
- `metadata?: Record<string, string>` - Дополнительные метаданные

**Возвращает:** `FileUploadResultDto`

### `deleteFile(bucket, path)`

Удаляет файл из MinIO.

### `getFileUrl(bucket, path, expiresIn?)`

Получает URL файла. Для приватных файлов генерирует подписанный URL.

**Параметры:**

- `expiresIn: number` - Время жизни URL в секундах (по умолчанию 3600)

### `fileExists(bucket, path)`

Проверяет существование файла.

### `getFileMetadata(bucket, path)`

Получает метаданные файла (размер, тип, дата изменения).

### `listFiles(bucket, prefix?)`

Получает список файлов в bucket.

### `copyFile(sourceBucket, sourcePath, destBucket, destPath)`

Копирует файл между buckets.

## Валидация файлов

Используйте `FileValidator` для валидации:

```typescript
import { FileValidator } from './modules/storage/utils/file-validator';

// Валидация изображения
FileValidator.validateImage(file);

// Валидация документа
FileValidator.validateDocument(file);

// Валидация логотипа
FileValidator.validateLogo(file);

// Универсальная валидация
FileValidator.validate(file, {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ['image/png', 'image/jpeg'],
  isImage: true,
});
```

### Ограничения по умолчанию

- **Документы:** до 10MB, типы: `application/pdf`, `image/jpeg`, `image/png`
- **Изображения:** до 5MB, типы: `image/jpeg`, `image/png`, `image/webp`
- **Логотипы:** до 2MB, только изображения

## Тестовые эндпоинты

Для тестирования доступны эндпоинты в `StorageTestController`:

- `POST /storage-test/upload/:bucket` - Загрузка файла
- `GET /storage-test/url/:bucket/:path` - Получение URL
- `GET /storage-test/exists/:bucket/:path` - Проверка существования
- `GET /storage-test/metadata/:bucket/:path` - Метаданные
- `GET /storage-test/list/:bucket` - Список файлов
- `DELETE /storage-test/delete/:bucket/:path` - Удаление

## Пример использования в контроллере

```typescript
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './modules/storage/storage.service';
import { FileValidator } from './modules/storage/utils/file-validator';

@Controller('brands')
export class BrandsController {
  constructor(private storageService: StorageService) {}

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id') brandId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Валидация
    FileValidator.validateLogo(file);

    // Загрузка
    const result = await this.storageService.uploadFile(
      'brands',
      `${brandId}/logo/logo.png`,
      file,
    );

    return result;
  }
}
```

## Безопасность

1. **Валидация файлов:** Всегда используйте `FileValidator` перед загрузкой
2. **Ограничение размера:** Настройте максимальный размер файлов
3. **MIME типы:** Проверяйте типы файлов перед загрузкой
4. **Приватные файлы:** Используйте подписанные URL для приватных файлов
5. **Права доступа:** Настройте bucket policies в MinIO для ограничения доступа

## Миграция на продакшен

Для продакшена рекомендуется:

1. Изменить credentials MinIO
2. Настроить SSL/TLS (`STORAGE_USE_SSL=true`)
3. Настроить репликацию MinIO для отказоустойчивости
4. Использовать внешний MinIO или AWS S3
5. Настроить CDN для публичных файлов
