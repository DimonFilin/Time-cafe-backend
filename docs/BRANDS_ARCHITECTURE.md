# Архитектура управления брендами

## Текущее состояние

**Модель Brand уже существует в Prisma:**

- `id` - UUID
- `name` - название бренда
- `description` - описание (опционально)
- `logo` - URL логотипа (опционально)
- `primaryColor` - основной цвет (опционально, по умолчанию "#000000")
- `createdAt`, `updatedAt` - временные метки

**Связи:**

- `cafes` - кофейни бренда
- `workerAccounts` - работники бренда (BRAND_ADMIN)

## Предлагаемая архитектура

### 1. Расширение модели Brand

**Добавить поля для кастомизации:**

```prisma
model Brand {
  // ... существующие поля ...

  // Кастомизация
  secondaryColor    String?   // Вторичный цвет
  accentColor       String?   // Акцентный цвет
  backgroundColor   String?   // Цвет фона
  textColor         String?   // Цвет текста
  fontFamily        String?   // Шрифт (опционально)

  // Медиа
  favicon           String?   // Favicon URL
  bannerImage       String?   // Баннер для шапки
  backgroundImage   String?   // Фоновое изображение

  // Контакты и информация
  website           String?   // Официальный сайт
  phone             String?   // Контактный телефон
  email             String?   // Контактный email
  address           String?   // Юридический адрес

  // Статус и верификация
  status            BrandStatus @default(PENDING) // PENDING, ACTIVE, SUSPENDED, REJECTED
  isVerified        Boolean   @default(false) // Верифицирован ли бренд
  verifiedAt       DateTime? // Дата верификации

  // Документы и подтверждения
  legalDocuments    BrandDocument[] // Массив документов

  // API ключи
  apiKeys           BrandApiKey[] // API ключи для доступа

  // Настройки
  settings          Json?     // Дополнительные настройки (JSON)

  // Soft delete
  deletedAt         DateTime?
}
```

**Новые модели:**

```prisma
enum BrandStatus {
  PENDING       // Ожидает проверки
  ACTIVE        // Активен
  SUSPENDED     // Приостановлен
  REJECTED      // Отклонен
}

model BrandDocument {
  id              String   @id @default(uuid())
  brandId         String
  brand           Brand    @relation(fields: [brandId], references: [id])

  type            DocumentType // REGISTRATION, LICENSE, CONTRACT, OTHER
  name            String   // Название документа
  fileUrl         String   // URL файла документа
  fileType        String?  // MIME type (application/pdf, image/jpeg и т.д.)
  fileSize        Int?     // Размер файла в байтах

  uploadedAt      DateTime @default(now())
  verifiedAt      DateTime? // Дата проверки документа
  verifiedBy      String?   // ID работника, проверившего документ
  isVerified      Boolean   @default(false)
  verificationNote String?  // Комментарий при проверке

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("brand_documents")
}

enum DocumentType {
  REGISTRATION    // Свидетельство о регистрации
  LICENSE         // Лицензия на деятельность
  CONTRACT        // Договор с платформой
  TAX_CERTIFICATE // Справка из налоговой
  BANK_STATEMENT  // Выписка из банка
  OTHER           // Другое
}

model BrandApiKey {
  id              String   @id @default(uuid())
  brandId         String
  brand           Brand    @relation(fields: [brandId], references: [id])

  name            String   // Название ключа (для идентификации)
  keyHash         String   // Хеш ключа (не храним сам ключ!)
  prefix          String   // Префикс ключа (первые 8 символов для отображения)

  permissions     String[] // Массив разрешений (например, ["create_cafe", "manage_workers"])
  isActive        Boolean  @default(true)
  lastUsedAt      DateTime? // Последнее использование
  expiresAt       DateTime? // Дата истечения (опционально)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime? // Soft delete

  @@index([brandId, isActive])
  @@map("brand_api_keys")
}
```

### 2. Стартовые данные для кастомизации

**При создании бренда устанавливаются значения по умолчанию:**

```typescript
{
  name: "Новый бренд",
  primaryColor: "#000000",      // Черный
  secondaryColor: "#FFFFFF",    // Белый
  accentColor: "#007BFF",      // Синий (акцент)
  backgroundColor: "#F8F9FA",  // Светло-серый фон
  textColor: "#212529",        // Темный текст
  fontFamily: "Inter, sans-serif", // Стандартный шрифт
  status: BrandStatus.PENDING,
  isVerified: false
}
```

**Настройки по умолчанию (JSON):**

```json
{
  "theme": {
    "mode": "light", // light, dark, auto
    "borderRadius": "8px",
    "spacing": "normal" // compact, normal, comfortable
  },
  "features": {
    "onlineOrders": true,
    "reservations": true,
    "loyaltyProgram": false,
    "giftCards": false
  },
  "notifications": {
    "email": true,
    "sms": false,
    "push": false
  }
}
```

### 3. Данные, которые нужно вносить при создании бренда

**Обязательные данные:**

- `name` - Название бренда
- `email` - Контактный email (для связи)
- `phone` - Контактный телефон
- `address` - Юридический адрес
- `website` - Официальный сайт (опционально, но рекомендуется)

**Документы (обязательные для верификации):**

1. **Свидетельство о регистрации** (ОГРН/ОГРНИП) - подтверждение юридического лица
2. **Лицензия на деятельность** (если требуется для кофеен/общепита)
3. **Договор с платформой** - подписанный договор о сотрудничестве
4. **Справка из налоговой** - подтверждение отсутствия задолженностей (опционально)
5. **Выписка из банка** - для подтверждения платежеспособности (опционально)

**Кастомизация (опционально, можно настроить позже):**

- Логотип
- Цветовая схема (primaryColor, secondaryColor, accentColor)
- Фоновое изображение
- Баннер

### 4. Подтверждения легального расположения на платформе

**Процесс верификации бренда:**

1. **Регистрация бренда:**
   - Заполнение базовой информации
   - Загрузка обязательных документов
   - Статус: `PENDING`

2. **Проверка документов (SYSTEM_ADMIN):**
   - Проверка подлинности документов
   - Проверка соответствия данных
   - Проверка лицензий (если требуются)
   - Статус: `PENDING` → `ACTIVE` или `REJECTED`

3. **Верификация:**
   - После успешной проверки: `isVerified = true`, `verifiedAt = now()`
   - При отклонении: `status = REJECTED`, `verificationNote` с причиной

4. **Активный бренд:**
   - Может создавать кофейни
   - Может управлять работниками
   - Может использовать API ключи
   - Может кастомизировать внешний вид

**Критерии для одобрения:**

- ✅ Все обязательные документы загружены
- ✅ Документы действительны (не истекли)
- ✅ Данные в документах соответствуют данным бренда
- ✅ Нет задолженностей перед государством
- ✅ Лицензии (если требуются) действительны

**Причины отклонения:**

- ❌ Неполный пакет документов
- ❌ Просроченные документы
- ❌ Несоответствие данных
- ❌ Наличие задолженностей
- ❌ Нарушение условий договора

### 5. API ключи для создания брендов

**Система API ключей:**

1. **Генерация ключа:**
   - Создается уникальный ключ (например, `tc_live_...` или `tc_test_...`)
   - Хранится только хеш ключа (SHA-256)
   - Префикс (первые 8 символов) для отображения
   - Ключ показывается только один раз при создании!

2. **Разрешения (permissions):**
   - `brands:create` - создание брендов
   - `brands:read` - чтение информации о брендах
   - `brands:update` - обновление брендов
   - `cafes:create` - создание кофеен
   - `cafes:manage` - управление кофейнями
   - `workers:manage` - управление работниками

3. **Использование:**
   - Ключ передается в заголовке: `X-API-Key: tc_live_...`
   - Проверка ключа перед выполнением операций
   - Логирование использования (`lastUsedAt`)

4. **Безопасность:**
   - Ключи можно отозвать (soft delete)
   - Можно установить срок действия (`expiresAt`)
   - Можно ограничить разрешения

### 6. Эндпоинты для управления брендами

**CRUD операции:**

- `POST /brands` - создание бренда (требует API ключ или права SYSTEM_ADMIN)
- `GET /brands` - список брендов (публичный, с фильтрацией)
- `GET /brands/:id` - детали бренда (публичный)
- `PATCH /brands/:id` - обновление бренда (требует права BRAND_ADMIN или SYSTEM_ADMIN)
- `DELETE /brands/:id` - удаление бренда (soft delete, только SYSTEM_ADMIN)

**Кастомизация:**

- `PATCH /brands/:id/customization` - обновление цветов, логотипа, темы
- `POST /brands/:id/logo` - загрузка логотипа
- `POST /brands/:id/banner` - загрузка баннера

**Документы:**

- `POST /brands/:id/documents` - загрузка документа
- `GET /brands/:id/documents` - список документов бренда
- `GET /brands/:id/documents/:docId` - получение документа
- `DELETE /brands/:id/documents/:docId` - удаление документа
- `PATCH /brands/:id/documents/:docId/verify` - верификация документа (SYSTEM_ADMIN)

**Верификация:**

- `POST /brands/:id/verify` - верификация бренда (SYSTEM_ADMIN)
- `POST /brands/:id/reject` - отклонение бренда (SYSTEM_ADMIN)
- `POST /brands/:id/suspend` - приостановка бренда (SYSTEM_ADMIN)

**API ключи:**

- `POST /brands/:id/api-keys` - создание API ключа
- `GET /brands/:id/api-keys` - список API ключей бренда
- `DELETE /brands/:id/api-keys/:keyId` - отзыв API ключа
- `PATCH /brands/:id/api-keys/:keyId` - обновление разрешений ключа

**Генерация ключей для создания брендов (SYSTEM_ADMIN):**

- `POST /admin/api-keys` - создание системного API ключа для создания брендов
- `GET /admin/api-keys` - список системных API ключей
- `DELETE /admin/api-keys/:keyId` - отзыв системного API ключа

### 7. Роли и доступ

**SYSTEM_ADMIN:**

- Создание/удаление брендов
- Верификация брендов
- Управление системными API ключами
- Просмотр всех документов

**BRAND_ADMIN:**

- Управление своим брендом
- Загрузка документов
- Создание API ключей для своего бренда
- Управление кофейнями бренда
- Управление работниками бренда

**Публичный доступ:**

- Просмотр списка активных брендов
- Просмотр деталей бренда (без документов)
- Просмотр кофеен бренда

### 8. Workflow создания бренда

1. **Регистрация:**

   ```
   POST /brands
   Headers: X-API-Key: tc_live_...
   Body: { name, email, phone, address, website?, ... }
   → Status: PENDING
   ```

2. **Загрузка документов:**

   ```
   POST /brands/:id/documents
   Body: { type: "REGISTRATION", file: ... }
   → Документ загружен, isVerified: false
   ```

3. **Проверка (SYSTEM_ADMIN):**

   ```
   PATCH /brands/:id/documents/:docId/verify
   Body: { isVerified: true, verificationNote: "Документ проверен" }
   → Документ верифицирован
   ```

4. **Активация бренда (SYSTEM_ADMIN):**

   ```
   POST /brands/:id/verify
   → status: ACTIVE, isVerified: true
   ```

5. **Кастомизация (BRAND_ADMIN):**
   ```
   PATCH /brands/:id/customization
   Body: { primaryColor, logo, ... }
   → Бренд кастомизирован
   ```

### 9. Хранение файлов

**Рекомендации:**

- Использовать облачное хранилище (S3, Cloud Storage) для документов и изображений
- Не хранить файлы в базе данных
- Хранить только URL файлов
- Использовать CDN для быстрой загрузки

**Структура хранения:**

```
brands/
  {brandId}/
    logo/
      logo.png
    banner/
      banner.jpg
    documents/
      registration.pdf
      license.pdf
      contract.pdf
```

### 10. Безопасность

**Меры безопасности:**

1. Валидация всех загружаемых файлов (тип, размер)
2. Сканирование файлов на вирусы (опционально)
3. Ограничение размера файлов (например, 10MB для документов, 5MB для изображений)
4. Проверка MIME типов
5. Хеширование API ключей (SHA-256)
6. Rate limiting для API ключей
7. Логирование всех операций с брендами

## Итоговая структура

**Что будет реализовано:**

1. ✅ Расширенная модель Brand с кастомизацией
2. ✅ Модель BrandDocument для документов
3. ✅ Модель BrandApiKey для API ключей
4. ✅ CRUD операции для брендов
5. ✅ Загрузка и управление документами
6. ✅ Система верификации брендов
7. ✅ Генерация и управление API ключами
8. ✅ Кастомизация внешнего вида
9. ✅ Роли и права доступа
10. ✅ Тесты для всех операций
