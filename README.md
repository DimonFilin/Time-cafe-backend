# Backend Shared

Единый backend API для админки и мобильного приложения Time Caffe.

## Что это за сервис

`backend-shared` отвечает за:

- аутентификацию и авторизацию через Keycloak;
- доменную бизнес-логику (бренды, кофейни, пользователи, работники, бронирования, заказы);
- файловое хранилище (S3/MinIO, signed URLs);
- чат заказа (HTTP API + Socket.IO realtime);
- role-specific API для `SYSTEM_ADMIN`, `BRAND_ADMIN`, `CAFE_ADMIN`, `WORKER`, `USER`.

## Технологический стек

- NestJS
- Prisma + PostgreSQL
- Keycloak
- Socket.IO
- MinIO (S3-compatible)
- Swagger

## Архитектура по слоям

- **Controllers**: HTTP endpoints и DTO boundary
- **Services**: бизнес-правила и orchestration
- **Prisma layer**: доступ к БД
- **Gateway layer**: realtime-события (`/order-chats`)
- **Storage layer**: upload/download/signed URL

Ключевые модули:

- `auth`
- `users`, `workers`
- `brands`, `cafes`
- `appointments`, `orders`
- `order-chat`
- `storage`
- `system-admin`, `brand-admin`, `cafe-admin`, `cafe-worker`

## Быстрый запуск (dev)

1. Установить зависимости:

```bash
npm install
```

2. Подготовить `.env` и поднять внешние зависимости (PostgreSQL, Keycloak, MinIO).

3. Сгенерировать Prisma client и применить миграции:

```bash
npm run prisma:generate
npm run prisma:deploy
```

4. Запустить API:

```bash
npm run start:api
```

Swagger:

- `http://localhost:3000/api/docs`

## Ключевая логика order-chat

- Чат привязан к заказу (`orderId`), есть fallback-вход из booking.
- Отправка сообщения доступна через HTTP и WS, realtime-рассылка выполняется сервером.
- Вложения:
  - upload в storage;
  - mime/size validation;
  - защита от чужих attachment IDs;
  - signed URL для выдачи;
  - обработка mobile-friendly endpoint (чтобы не отдавать `localhost` на устройство).
- Роутинг unread/list updates выполняется по серверным правилам (`ALL/ROLE/SPECIFIC`).

Подробнее:

- `docs/CHAT_MODULE.md`

## Качество и проверки

Основные команды:

```bash
# Build
npm run build:api

# Tests
npm run test

# Prisma
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:studio
```

Минимальная проверка перед QA:

- `npm run build:api`
- smoke-проверка auth (`/auth/me`, `/auth/refresh`)
- smoke-проверка chat HTTP + WS
- smoke-проверка upload и signed URL

## Где читать детали

- `docs/ARCHITECTURE.md` — общая архитектура
- `docs/API_ENDPOINTS.md` — обзор API
- `docs/KEYCLOAK.md` — auth и токены
- `docs/STORAGE.md` — storage и signed URLs
- `docs/CHAT_MODULE.md` — внутренняя реализация чата
- `docs/AUTH_LOGIN_FLOW.md` — детали login/refresh сценария
