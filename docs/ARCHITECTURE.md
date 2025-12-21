# Архитектура Backend Shared

## Общая структура

Проект использует модульную архитектуру NestJS с четким разделением ответственности.

## Слои архитектуры

### 1. Infrastructure Layer (Инфраструктурный слой)

Модули без зависимостей от бизнес-логики:

- **KeycloakModule** - интеграция с Keycloak (аутентификация)
- **PrismaModule** - работа с базой данных
- **HttpModule** - HTTP клиент для внешних запросов

### 2. Business Layer (Бизнес-слой)

Модули с бизнес-логикой, зависят только от инфраструктуры:

- **UsersModule** - управление пользователями (клиентами)
- **WorkersModule** - управление работниками
- **AuthModule** - общая логика аутентификации (токены, логин)

### 3. Feature Layer (Слой функций)

Контроллеры и сервисы для конкретных функций:

- **SystemModule** - системные эндпоинты
- **BrandsModule** - управление брендами
- **CafesModule** - управление кофейнями
- **SystemAdminModule** - функции системного администратора
- **BrandAdminModule** - функции администратора бренда

## Правила зависимостей

### ✅ Правильная архитектура

```
Infrastructure (KeycloakModule, PrismaModule)
    ↑
    ├── Business (UsersModule, WorkersModule, AuthModule)
    │   ↑
    │   └── Feature (SystemModule, BrandsModule, etc.)
```

### ❌ Запрещено

- Циклические зависимости между модулями
- Использование `forwardRef()` (это признак архитектурной проблемы)
- Зависимости бизнес-модулей друг от друга
- Зависимости инфраструктуры от бизнес-логики

## Разделение User и WorkerAccount

### Принцип: Один email = один аккаунт

Один email может быть либо User, либо WorkerAccount, но не оба одновременно.

### Эндпоинты

**User:**

- `POST /auth/register` - регистрация
- `GET /auth/me` - профиль (TODO)
- `PATCH /auth/me` - обновление профиля (TODO)

**WorkerAccount:**

- `POST /auth/workers` - регистрация
- `GET /auth/workers/me` - профиль
- `PATCH /auth/workers/me` - обновление профиля

**Общие:**

- `POST /auth/login` - авторизация (определяет тип автоматически)
- `POST /auth/refresh` - обновление токена

### Архитектура модулей

```
KeycloakModule (инфраструктура)
    ↑
    ├── AuthModule
    │   └── AuthService (только операции с токенами)
    │
    ├── UsersModule
    │   └── UsersService (бизнес-логика User)
    │
    └── WorkersModule
        └── WorkersService (бизнес-логика WorkerAccount + регистрация)
```

## Хранение данных

### Keycloak (аутентификация)

- keycloakId
- email
- password (хешированный)

### Prisma (бизнес-данные)

**User:**

- keycloakId, email
- firstName, lastName, phone, avatar
- balance
- Связи: orders, reviews, bookings

**WorkerAccount:**

- keycloakId, email
- firstName, lastName
- role (SYSTEM_ADMIN, BRAND_ADMIN, CAFE_ADMIN, WORKER)
- brandId, cafeId
- Связи: brand, cafe

## Синхронизация данных

- **При регистрации**: Dual-write (запись в Keycloak и Prisma одновременно)
- **При логине**: Автоматическое создание/обновление записи в Prisma
- **При обновлении email в Keycloak**: Webhook синхронизирует в Prisma
- **Бизнес-данные**: Изменения в Prisma не синхронизируются с Keycloak

## Тестирование

- E2E тесты для всех эндпоинтов (26 тестов)
- Pre-commit hooks с автоматическим запуском тестов
- ValidationPipe настроен глобально
