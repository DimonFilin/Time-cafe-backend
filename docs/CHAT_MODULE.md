# Order Chat Module (`order-chat`)

Техническая документация по внутренней реализации чата заказа в `backend-shared`.

## Что делает модуль

`order-chat` покрывает:

- создание/получение чата по заказу,
- список чатов с фильтрами и поиском,
- историю сообщений,
- отправку сообщений,
- upload вложений,
- read-state,
- typing-state,
- realtime рассылку событий.

## Архитектура

- `order-chat.controller.ts` — HTTP API
- `order-chat.service.ts` — бизнес-логика и доступ к Prisma/Storage
- `order-chat.gateway.ts` — Socket.IO namespace `/order-chats`
- `dto/*` — типы запросов/ответов

## Доступ и безопасность

- Актер вычисляется на backend по `keycloakId` (`resolveActorByKeycloakId`).
- Проверка доступа централизована (`ensureChatAccess`).
- Роли:
  - `USER` — только свои чаты,
  - `WORKER/CAFE_ADMIN` — чаты своей кофейни,
  - `BRAND_ADMIN` — чаты своего бренда,
  - `SYSTEM_ADMIN` — полный доступ.

## Realtime контракт

Основные события:

- `chat:join` / `chat:leave`
- `chat:message:new`
- `chat:typing`
- `chat:unread:update`
- `chat:list:update`

Важно:

- рассылка выполняется сервером после отправки сообщения (вне зависимости от HTTP или WS источника),
- unread/list routing строится по server-side правилам.

## Вложения

- Upload endpoint: `POST /order-chats/:chatId/uploads`
- Ограничения:
  - только изображения (`jpeg/png/webp`),
  - проверка размера и mime,
  - orphan cleanup для неиспользованных upload'ов.
- Для выдачи используются signed URLs.
- Для мобильных сценариев поддерживается endpoint-aware генерация URL (чтобы не отдавать `localhost` устройству).

## Настройки чата кафе

Хранятся в `Cafe.chatSettings`:

- `enabled`,
- `notificationMode`,
- `notificationRoles`,
- `notificationWorkerIds`,
- `theme` (chat-specific override).

## Диагностика

Для отладки проблем чата рекомендуется проверять:

- логи gateway connect/join,
- `chatId/orderId` соответствие,
- signed URL host (не `localhost` для мобильного устройства),
- ошибки upload на уровне transport vs HTTP response.
