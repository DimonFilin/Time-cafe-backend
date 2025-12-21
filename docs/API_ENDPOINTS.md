# API Endpoints - Backend Shared

## Системные эндпоинты

### `GET /system/health-check`

Проверка здоровья сервиса и БД

- **Доступ**: Публичный
- **Ответ**: `{ status: "healthy" | "unhealthy", timestamp, checks: { database } }`

### `GET /system/ping`

Простой ping без проверок

- **Доступ**: Публичный
- **Ответ**: `{ status: "ok", message: "pong", timestamp }`

### `GET /system/metrics`

Метрики системы

- **Доступ**: Публичный
- **Ответ**: `{ uptime, memory, database, requests: { total, successful, errors, avgResponseTime } }`

## Аутентификация

### User (клиенты)

#### `POST /auth/register`

Регистрация нового пользователя

- **Доступ**: Публичный
- **Тело запроса**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890" // опционально
  }
  ```
- **Ответ (201)**: `{ accessToken, refreshToken, expiresIn, user: { id, email, firstName, lastName, phone, avatar, balance, createdAt } }`
- **Ошибки**: 400 (валидация), 409 (пользователь уже существует)

**Логика**:

1. Проверка существования в Keycloak и Prisma
2. Создание пользователя в Keycloak (email, password, emailVerified: true)
3. Создание записи в Prisma (keycloakId, email, firstName, lastName, phone)
4. Автоматический логин с retry логикой (до 10 попыток)
5. Возврат токенов и профиля

#### `POST /auth/login`

Авторизация (общая для User и WorkerAccount)

- **Доступ**: Публичный
- **Тело запроса**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Ответ (200)**: `{ accessToken, refreshToken, expiresIn, user: { ... } }`
- **Ошибки**: 401 (неверные credentials)

**Логика**:

1. Валидация credentials через Keycloak
2. Получение keycloakId из JWT токена
3. Определение типа аккаунта (User или WorkerAccount) по наличию в Prisma
4. Создание/обновление записи в Prisma по keycloakId
5. Возврат токенов и профиля

#### `POST /auth/refresh`

Обновление access token (общее для User и WorkerAccount)

- **Доступ**: Публичный
- **Тело запроса**:
  ```json
  {
    "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ..."
  }
  ```
- **Ответ (200)**: `{ accessToken, refreshToken, expiresIn, user: { ... } }`
- **Ошибки**: 401 (неверный/истекший refresh token)

**Логика**:

1. Обновление токенов через Keycloak
2. Декодирование нового access token
3. Поиск аккаунта в Prisma по keycloakId (User или WorkerAccount)
4. Возврат новых токенов и профиля

#### `GET /auth/me`

Получение профиля текущего пользователя

- **Доступ**: Требует Bearer token
- **Заголовок**: `Authorization: Bearer <accessToken>`
- **Ответ (200)**: `{ id, email, firstName, lastName, phone?, avatar?, balance, createdAt }`
- **Ошибки**: 401 (не авторизован), 404 (пользователь не найден)

#### `PATCH /auth/me`

Обновление профиля текущего пользователя

- **Доступ**: Требует Bearer token
- **Заголовок**: `Authorization: Bearer <accessToken>`
- **Тело запроса**:
  ```json
  {
    "firstName": "John", // опционально
    "lastName": "Doe", // опционально
    "phone": "+1234567890", // опционально
    "avatar": "https://example.com/avatar.jpg" // опционально
  }
  ```
- **Ответ (200)**: `{ id, email, firstName, lastName, phone?, avatar?, balance, createdAt }`
- **Ошибки**: 401 (не авторизован), 404 (пользователь не найден)

#### `POST /auth/change-password`

Смена пароля (общее для User и WorkerAccount)

- **Доступ**: Требует Bearer token
- **Заголовок**: `Authorization: Bearer <accessToken>`
- **Тело запроса**:
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewPassword123!"
  }
  ```
- **Ответ (200)**: `{ message: "Password changed successfully" }`
- **Ошибки**: 400 (валидация), 401 (неверный текущий пароль или не авторизован)

**Логика**:

1. Проверка текущего пароля через Keycloak
2. Обновление пароля в Keycloak через Admin API
3. Возврат успешного ответа

#### `DELETE /auth/me`

Удаление аккаунта пользователя (soft delete)

- **Доступ**: Требует Bearer token
- **Заголовок**: `Authorization: Bearer <accessToken>`
- **Ответ (200)**: `{ message: "User account deleted successfully" }`
- **Ошибки**: 401 (не авторизован), 404 (пользователь не найден)

**Логика**:

1. Удаление пользователя из Keycloak (полное удаление)
2. Soft delete в Prisma (установка `deletedAt`)
3. После удаления можно создать нового пользователя с тем же email

### WorkerAccount (работники)

#### `POST /auth/workers`

Регистрация нового работника

- **Доступ**: Публичный
- **Тело запроса**:
  ```json
  {
    "email": "worker@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CAFE_ADMIN", // SYSTEM_ADMIN, BRAND_ADMIN, CAFE_ADMIN, WORKER
    "brandId": "123e4567-e89b-12d3-a456-426614174000", // опционально
    "cafeId": "123e4567-e89b-12d3-a456-426614174001" // опционально
  }
  ```
- **Ответ (201)**: `{ accessToken, refreshToken, expiresIn, user: { id, email, firstName, lastName, ... } }`
- **Ошибки**: 400 (валидация), 409 (работник уже существует или email занят как User)

**Логика**:

1. Проверка существования в Keycloak
2. Проверка, что email не занят как User
3. Проверка существования работника в Prisma
4. Создание работника в Keycloak (email, password, emailVerified: true)
5. Создание записи в Prisma (keycloakId, email, firstName, lastName, role, brandId?, cafeId?)
6. Автоматический логин с retry логикой (до 10 попыток)
7. Возврат токенов и профиля

#### `GET /auth/workers/me`

Получение профиля текущего работника

- **Доступ**: Требует Bearer token
- **Заголовок**: `Authorization: Bearer <accessToken>`
- **Ответ (200)**: `{ id, email, firstName, lastName, role, brandId?, cafeId?, createdAt }`
- **Ошибки**: 401 (не авторизован), 404 (аккаунт работника не найден)

#### `PATCH /auth/workers/me`

Обновление профиля текущего работника

- **Доступ**: Требует Bearer token
- **Заголовок**: `Authorization: Bearer <accessToken>`
- **Тело запроса**:
  ```json
  {
    "firstName": "John", // опционально
    "lastName": "Doe", // опционально
    "role": "CAFE_ADMIN", // опционально
    "brandId": "123e4567-e89b-12d3-a456-426614174000", // опционально
    "cafeId": "123e4567-e89b-12d3-a456-426614174001" // опционально
  }
  ```
- **Ответ (200)**: `{ id, email, firstName, lastName, role, brandId?, cafeId?, createdAt }`
- **Ошибки**: 401 (не авторизован), 404 (аккаунт работника не найден)

#### `DELETE /auth/workers/me`

Удаление аккаунта работника (soft delete)

- **Доступ**: Требует Bearer token
- **Заголовок**: `Authorization: Bearer <accessToken>`
- **Ответ (200)**: `{ message: "Worker account deleted successfully" }`
- **Ошибки**: 401 (не авторизован), 404 (аккаунт работника не найден)

**Логика**:

1. Удаление работника из Keycloak (полное удаление)
2. Soft delete в Prisma (установка `deletedAt`)
3. После удаления можно создать нового работника с тем же email

### Webhook

#### `POST /auth/webhook/keycloak`

Webhook для синхронизации данных из Keycloak

- **Доступ**: Публичный (в продакшене нужна проверка подписи)
- **Тело запроса**: Keycloak event payload
- **Ответ (200)**: `{ status: "ok" }`

**Логика**:

- Обрабатывает события: REGISTER, UPDATE_PROFILE, DELETE
- Синхронизирует email из Keycloak в Prisma (для User и WorkerAccount)

## Тестовые эндпоинты

### `GET /auth-test/public`

Публичный тестовый эндпоинт

- **Доступ**: Публичный
- **Ответ**: `{ message: "Public endpoint - no authentication required", timestamp }`

### `GET /auth-test/protected`

Защищенный тестовый эндпоинт

- **Доступ**: Требует Bearer token
- **Заголовок**: `Authorization: Bearer <accessToken>`
- **Ответ**: `{ message: "Protected endpoint - authentication successful", authenticated: true, clientId, timestamp }`
- **Ошибки**: 401 (нет токена/неверный токен)

### `GET /auth-test/keycloak-ping`

Проверка доступности Keycloak

- **Доступ**: Публичный
- **Ответ**: `{ status: "ok", keycloakUrl, realm, accessible: true, timestamp }`

## Документация

### `GET /api/docs`

Swagger документация API

- **Доступ**: Публичный
- Полная интерактивная документация всех эндпоинтов
- Возможность тестирования через Swagger UI

## Архитектура данных

### Keycloak (аутентификация)

- User ID (keycloakId)
- Email
- Password (хешированный)
- Email verification status

### Prisma (бизнес-данные)

- keycloakId (связь с Keycloak)
- Email (синхронизируется с Keycloak)
- firstName, lastName, phone, avatar
- balance, createdAt, updatedAt
- Связи с заказами, отзывами, бронированиями

## Валидация

Все эндпоинты используют ValidationPipe с:

- `whitelist: true` - удаление неразрешенных полей
- `forbidNonWhitelisted: true` - ошибка при неразрешенных полях
- `transform: true` - автоматическое преобразование типов

### Правила валидации RegisterDto:

- `email`: валидный email формат
- `password`: минимум 8 символов
- `firstName`: строка (обязательно)
- `lastName`: строка (обязательно)
- `phone`: строка (опционально)
