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

### `POST /auth/register`

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

### `POST /auth/login`

Авторизация пользователя

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
3. Создание/обновление записи в Prisma по keycloakId
4. Возврат токенов и профиля

### `POST /auth/refresh`

Обновление access token

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
3. Поиск пользователя в Prisma по keycloakId
4. Возврат новых токенов и профиля

### `POST /auth/webhook/keycloak`

Webhook для синхронизации данных из Keycloak

- **Доступ**: Публичный (в продакшене нужна проверка подписи)
- **Тело запроса**: Keycloak event payload
- **Ответ (200)**: `{ status: "ok" }`

**Логика**:

- Обрабатывает события: REGISTER, UPDATE_PROFILE, DELETE
- Синхронизирует email из Keycloak в Prisma

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
