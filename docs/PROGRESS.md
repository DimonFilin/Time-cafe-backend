# Backend Shared - Progress

## Текущий этап разработки

**Аутентификация и авторизация через Keycloak - ЗАВЕРШЕНО ✅**

Базовая функциональность аутентификации и авторизации полностью реализована:

- Разделение User и WorkerAccount с отдельными эндпоинтами
- Регистрация, логин, обновление токенов для обоих типов аккаунтов
- Правильная архитектура без циклических зависимостей

## Что реализовано ✅

### Инфраструктура

- ✅ Настроен NestJS проект с TypeScript
- ✅ Интегрирован Next.js для фронтенда
- ✅ Настроен Prisma ORM с PostgreSQL
- ✅ Настроен Winston для логирования (файлы в `logs/`)
- ✅ Настроен Swagger документация с авторизацией JWT
- ✅ Настроен CORS и валидация запросов
- ✅ Создана структура модулей (auth, users, brands, cafes, system-admin, brand-admin)

### База данных

- ✅ Создана Prisma схема с моделями:
  - WorkerAccount (аккаунты работников) - с keycloakId, без password
  - User (пользователи) - с keycloakId, без password
  - Brand (бренды)
  - Region (регионы)
  - Cafe (кофейни)
  - Order (заказы)
  - Review (отзывы)
  - Appointment (бронирования)
- ✅ Prisma Client сгенерирован
- ✅ Миграция БД выполнена (keycloakId добавлен, password удален)

### Системные эндпоинты

- ✅ `GET /system/health-check` - проверка здоровья сервиса и БД
- ✅ `GET /system/ping` - простой ping без проверок
- ✅ `GET /system/metrics` - метрики системы (uptime, память, БД, запросы)
- ✅ `GET /api/docs` - Swagger документация

### DTO и типизация

- ✅ Создана структура DTO в `src/modules/system/dto/`:
  - HealthCheckResponseDto
  - PingResponseDto
  - MetricsResponseDto
- ✅ Все эндпоинты типизированы и документированы в Swagger

### Метрики и мониторинг

- ✅ Реализован MetricsService для подсчета запросов
- ✅ Реализован MetricsInterceptor для автоматического подсчета
- ✅ Счетчики: total, successful, errors, avgResponseTime

### Аутентификация и авторизация

- ✅ Интеграция с Keycloak (KeycloakService, KeycloakModule)
- ✅ Регистрация пользователей (`POST /auth/register`)
- ✅ Регистрация работников (`POST /auth/workers`)
- ✅ Авторизация через Keycloak (`POST /auth/login`) - общая для User и WorkerAccount
- ✅ Обновление токенов (`POST /auth/refresh`) - общее для всех типов аккаунтов
- ✅ Разделение данных: Keycloak хранит только email/password, Prisma - бизнес-данные
- ✅ Разделение эндпоинтов: User и WorkerAccount имеют отдельные эндпоинты регистрации
- ✅ Правильная архитектура: устранены циклические зависимости между модулями
- ✅ Webhook сервис для синхронизации данных из Keycloak (`POST /auth/webhook/keycloak`)
- ✅ E2E тесты для всех эндпоинтов авторизации (26 тестов, все проходят)
- ✅ DTOs для валидации:
  - User: RegisterDto, LoginDto, RefreshTokenDto, AuthResponseDto, UserProfileDto
  - WorkerAccount: RegisterWorkerDto, UpdateWorkerDto, WorkerProfileDto
- ✅ ValidationPipe настроен глобально и в тестах
- ✅ WorkersModule с полной функциональностью для работников

### Тестирование

- ✅ E2E тесты для системных эндпоинтов (3 теста)
- ✅ E2E тесты для Keycloak интеграции (3 теста)
- ✅ E2E тесты для авторизации User (9 тестов: register, login, refresh)
- ✅ E2E тесты для авторизации WorkerAccount (10 тестов: register с разными ролями, login, валидация)
- ✅ E2E тесты для профиля User (10 тестов: get profile, update profile, change password)
- ✅ Всего: 36 тестов, все проходят
- ✅ Pre-commit hooks с Husky и lint-staged

## Реализованные эндпоинты 📡

### Системные эндпоинты (`/system`)

- **`GET /system/health-check`** - Проверка здоровья сервиса и БД
  - Возвращает статус сервиса (healthy/unhealthy)
  - Проверяет подключение к БД
  - Публичный доступ
- **`GET /system/ping`** - Простой ping без проверок
  - Возвращает статус "pong" и timestamp
  - Публичный доступ
- **`GET /system/metrics`** - Метрики системы
  - Счетчики запросов (total, successful, errors)
  - Среднее время ответа
  - Использование памяти
  - Статус БД
  - Публичный доступ

### Эндпоинты аутентификации (`/auth`)

#### User (клиенты)

- **`POST /auth/register`** - Регистрация нового пользователя
  - Создает пользователя в Keycloak (email, password)
  - Создает запись в Prisma (keycloakId, email, firstName, lastName, phone)
  - Возвращает accessToken, refreshToken, expiresIn, user profile
  - Валидация: email (формат), password (мин. 8 символов), firstName, lastName
  - Ошибки: 400 (валидация), 409 (пользователь уже существует)
  - Публичный доступ

- **`POST /auth/login`** - Авторизация (общая для User и WorkerAccount)
  - Проверяет credentials в Keycloak
  - Определяет тип аккаунта (User или WorkerAccount) по наличию в Prisma
  - Создает/обновляет запись в Prisma по keycloakId
  - Возвращает accessToken, refreshToken, expiresIn, user profile
  - Ошибки: 401 (неверные credentials)
  - Публичный доступ

- **`POST /auth/refresh`** - Обновление access token (общее для всех типов)
  - Обновляет токены через Keycloak
  - Возвращает новые accessToken, refreshToken, expiresIn, user profile
  - Ошибки: 401 (неверный/истекший refresh token)
  - Публичный доступ

- **`GET /auth/me`** - Получение профиля текущего пользователя
  - Возвращает полный профиль пользователя (id, email, firstName, lastName, phone, avatar, balance)
  - Требует Bearer token в заголовке Authorization
  - Ошибки: 401 (не авторизован), 404 (пользователь не найден)
  - Защищенный доступ

- **`PATCH /auth/me`** - Обновление профиля текущего пользователя
  - Обновляет firstName, lastName, phone, avatar
  - Требует Bearer token в заголовке Authorization
  - Ошибки: 401 (не авторизован), 404 (пользователь не найден)
  - Защищенный доступ

- **`POST /auth/change-password`** - Смена пароля (общее для User и WorkerAccount)
  - Проверяет текущий пароль через Keycloak
  - Обновляет пароль в Keycloak через Admin API
  - Требует Bearer token в заголовке Authorization
  - Валидация: newPassword (мин. 8 символов)
  - Ошибки: 400 (валидация), 401 (неверный текущий пароль или не авторизован)
  - Защищенный доступ

#### WorkerAccount (работники)

- **`POST /auth/workers`** - Регистрация нового работника
  - Создает работника в Keycloak (email, password)
  - Создает запись в Prisma (keycloakId, email, firstName, lastName, role, brandId?, cafeId?)
  - Проверяет, что email не занят как User
  - Возвращает accessToken, refreshToken, expiresIn, user profile
  - Валидация: email (формат), password (мин. 8 символов), firstName, lastName, role (enum)
  - Ошибки: 400 (валидация), 409 (работник уже существует или email занят как User)
  - Публичный доступ

- **`GET /auth/workers/me`** - Получение профиля текущего работника
  - Возвращает профиль работника (id, email, firstName, lastName, role, brandId, cafeId)
  - Требует Bearer token в заголовке Authorization
  - Ошибки: 401 (не авторизован), 404 (аккаунт работника не найден)
  - Защищенный доступ

- **`PATCH /auth/workers/me`** - Обновление профиля текущего работника
  - Обновляет firstName, lastName, role, brandId, cafeId
  - Требует Bearer token в заголовке Authorization
  - Ошибки: 401 (не авторизован), 404 (аккаунт работника не найден)
  - Защищенный доступ

- **`POST /auth/webhook/keycloak`** - Webhook для синхронизации данных из Keycloak
  - Принимает события от Keycloak (REGISTER, UPDATE_PROFILE, DELETE)
  - Синхронизирует email из Keycloak в Prisma
  - Публичный доступ (в продакшене нужна проверка подписи)

### Тестовые эндпоинты (`/auth-test`)

- **`GET /auth-test/public`** - Публичный тестовый эндпоинт
  - Проверка работы без аутентификации
  - Публичный доступ
- **`GET /auth-test/protected`** - Защищенный тестовый эндпоинт
  - Проверка работы с Keycloak токеном
  - Требует Bearer token в заголовке Authorization
  - Ошибки: 401 (нет токена/неверный токен)
- **`GET /auth-test/keycloak-ping`** - Проверка доступности Keycloak
  - Проверяет подключение к Keycloak серверу
  - Возвращает статус доступности
  - Публичный доступ

### Документация

- **`GET /api/docs`** - Swagger документация API
  - Полная документация всех эндпоинтов
  - Возможность тестирования через Swagger UI
  - Публичный доступ

## Логика работы аутентификации 🔐

### Архитектура данных

- **Keycloak** хранит только данные для аутентификации:
  - User ID (keycloakId)
  - Email
  - Password (хешированный)
  - Email verification status
- **Prisma (PostgreSQL)** хранит бизнес-данные:
  - keycloakId (связь с Keycloak)
  - Email (синхронизируется с Keycloak)
  - firstName, lastName, phone, avatar
  - balance, createdAt, updatedAt
  - Связи с заказами, отзывами, бронированиями

### Регистрация (`POST /auth/register`)

1. Проверка существования пользователя в Keycloak по email
2. Проверка существования пользователя в Prisma по email
3. Создание пользователя в Keycloak с `emailVerified: true`
4. Создание записи в Prisma с keycloakId
5. Попытка автоматического логина (с retry логикой, до 10 попыток)
6. Возврат токенов и профиля пользователя

### Авторизация (`POST /auth/login`)

1. Валидация credentials через Keycloak OpenID Connect
2. Получение keycloakId из JWT токена
3. Получение данных пользователя из Keycloak
4. Создание/обновление записи в Prisma через `getOrCreateByKeycloakId`
5. Возврат токенов и профиля пользователя

### Обновление токена (`POST /auth/refresh`)

1. Обновление токенов через Keycloak
2. Декодирование нового access token для получения keycloakId
3. Поиск пользователя в Prisma по keycloakId
4. Возврат новых токенов и профиля пользователя

### Синхронизация данных

- **При регистрации/логине**: Dual-write (запись в оба хранилища)
- **При обновлении профиля в Keycloak**: Webhook синхронизирует email в Prisma
- **Периодическая синхронизация**: `KeycloakWebhookService.syncAllUsers()` (требует настройки)

### Безопасность

- Все пароли хранятся только в Keycloak (хешированные)
- JWT токены выдаются Keycloak
- ValidationPipe валидирует все входящие данные
- CORS настроен для фронтенда
- Webhook требует проверки подписи (закомментировано для разработки)

### Архитектура

- ✅ Правильная архитектура без циклических зависимостей
- ✅ Разделение на слои: Infrastructure → Business → Feature
- ✅ WorkersModule использует KeycloakService напрямую (не через AuthModule)
- ✅ Четкое разделение ответственности между модулями
- ✅ Один email = один аккаунт (User или WorkerAccount)

## Что нужно сделать 🔨

### Аутентификация и авторизация

- ✅ Регистрация User и WorkerAccount - **ЗАВЕРШЕНО**
- ✅ Логин и обновление токенов - **ЗАВЕРШЕНО**
- ✅ Разделение эндпоинтов по типам аккаунтов - **ЗАВЕРШЕНО**
- ✅ Эндпоинт получения профиля User (`GET /auth/me`) - **ЗАВЕРШЕНО**
- ✅ Эндпоинт обновления профиля User (`PATCH /auth/me`) - **ЗАВЕРШЕНО**
- ✅ Эндпоинт смены пароля (`POST /auth/change-password`) - **ЗАВЕРШЕНО**

### Управление пользователями

- [x] CRUD операции для пользователей - **ЗАВЕРШЕНО**
  - ✅ Create: `POST /auth/register` (User), `POST /auth/workers` (WorkerAccount)
  - ✅ Read: `GET /auth/me` (User), `GET /auth/workers/me` (WorkerAccount)
  - ✅ Update: `PATCH /auth/me` (User), `PATCH /auth/workers/me` (WorkerAccount)
  - ✅ Delete: `DELETE /auth/me` (User), `DELETE /auth/workers/me` (WorkerAccount) - soft delete
- [x] Профиль пользователя (просмотр, редактирование) - **ЗАВЕРШЕНО**
  - ✅ `GET /auth/me` - просмотр профиля
  - ✅ `PATCH /auth/me` - редактирование профиля (firstName, lastName, phone, avatar)
- [x] Управление балансом и картами - **ЗАВЕРШЕНО**
  - ✅ Модель PaymentCard создана
  - ✅ Эндпоинты для управления картами (добавление, удаление, установка по умолчанию)
  - ✅ Прямые платежи с карты (без хранения баланса)
  - ⚠️ Баланс в модели User оставлен для будущего использования (бонусы, возвраты), но не используется для пополнения
- [x] История транзакций - **ЗАВЕРШЕНО**
  - ✅ Модель Transaction создана
  - ✅ Эндпоинты для просмотра истории (с пагинацией)
  - ✅ Эндпоинты для создания платежей и возвратов
  - ✅ Симуляция Stripe (валидация = успех)

### Управление брендами - ЗАВЕРШЕНО ✅

- ✅ CRUD операции для брендов
  - ✅ POST /brands - создание бренда (публичный, с валидацией)
  - ✅ GET /brands - список брендов с фильтрацией по статусу
  - ✅ GET /brands/:id - детали бренда (публичный)
  - ✅ PATCH /brands/:id - обновление бренда (BRAND_ADMIN или SYSTEM_ADMIN)
  - ✅ DELETE /brands/:id - soft delete (SYSTEM_ADMIN)
- ✅ Настройка бренда (цвета, логотип, тема)
  - ✅ PATCH /brands/:id/customization - обновление кастомизации (BRAND_ADMIN)
  - ✅ POST /brands/:id/logo - загрузка логотипа в MinIO (BRAND_ADMIN)
  - ✅ POST /brands/:id/banner - загрузка баннера в MinIO (BRAND_ADMIN)
  - ✅ Валидация hex-цветов, размеров файлов
- ✅ Выдача ключей для создания брендов
  - ✅ POST /brands/:id/api-keys - создание API ключа (BRAND_ADMIN)
  - ✅ GET /brands/:id/api-keys - список ключей (BRAND_ADMIN)
  - ✅ PATCH /brands/:id/api-keys/:keyId - обновление разрешений (BRAND_ADMIN)
  - ✅ DELETE /brands/:id/api-keys/:keyId - отзыв ключа (BRAND_ADMIN)
  - ✅ Генерация уникальных ключей (tc*live*...), хеширование SHA-256
- ✅ Workflow управления брендами
  - ✅ POST /brands/:id/documents - загрузка документов (требует авторизации)
  - ✅ GET /brands/:id/documents - список документов (публичный)
  - ✅ GET /brands/:id/documents/:docId - получение документа (публичный)
  - ✅ DELETE /brands/:id/documents/:docId - удаление документа (требует авторизации)
  - ✅ PATCH /brands/:id/documents/:docId/verify - верификация документа (SYSTEM_ADMIN)
  - ✅ POST /brands/:id/verify - активация бренда (SYSTEM_ADMIN, проверка обязательных документов)
  - ✅ POST /brands/:id/reject - отклонение бренда (SYSTEM_ADMIN)
  - ✅ POST /brands/:id/suspend - приостановка бренда (SYSTEM_ADMIN)
- ✅ Интеграция с MinIO для хранения файлов
  - ✅ Загрузка документов в bucket brands/{brandId}/documents/
  - ✅ Загрузка логотипов в bucket brands/{brandId}/logo/
  - ✅ Загрузка баннеров в bucket brands/{brandId}/banner/
  - ✅ Автоматическое удаление старых файлов при замене
- ✅ Проверка прав доступа
  - ✅ SYSTEM_ADMIN - доступ ко всем брендам
  - ✅ BRAND_ADMIN - доступ только к своему бренду (проверка через brandId)
  - ✅ Роли хранятся в БД (WorkerAccount.role), проверка через WorkersService
- ✅ E2E тесты для всех эндпоинтов (54 теста, все проходят)

### Управление кофейнями

- [x] CRUD операции для кофеен
  - [x] Создание кофейни (BRAND_ADMIN или SYSTEM_ADMIN)
  - [x] Получение списка кофеен с фильтрацией (публичный)
  - [x] Получение деталей кофейни (публичный)
  - [x] Обновление кофейни (BRAND_ADMIN своего бренда или SYSTEM_ADMIN)
  - [x] Удаление кофейни (soft delete с deletedAt)
- [x] Связь кофейни с брендом и регионом
  - [x] Проверка активности бренда при создании
  - [x] Валидация связей с брендом и регионом
  - [x] Фильтрация по бренду и региону
  - [x] Обновление связей (brandId, regionId) с проверкой прав доступа
- [x] API для получения списка кофеен (для мобильного приложения)
  - [x] Фильтрация (brandId, regionId, city)
  - [x] Пагинация (page, limit)
  - [x] Сортировка (по рейтингу, расстоянию, дате создания, количеству отзывов)
  - [x] Поиск по радиусу (формула гаверсинуса)
  - [x] Минимальный набор полей для списка (CafeListItemDto)
- [x] Поиск кофеен по региону/городу
  - [x] Поиск по городу (уже реализован в шаге 3)
  - [x] Поиск по региону (уже реализован в шаге 3)
  - [x] Поиск по стране (через регион)
  - [x] Полнотекстовый поиск (по имени, адресу, описанию)
  - [x] Комбинирование поиска с другими фильтрами
- [x] Интеграция картографических сервисов
  - [x] API для геокодинга адресов (Nominatim) - POST /cafes/geocode
  - [x] Обратный геокодинг (координаты → адрес) - POST /cafes/reverse-geocode
  - [x] Поиск ближайших кофеен (уже реализован в шаге 3)
  - [x] Документация по интеграции виджетов (Leaflet, Yandex Maps, Google Maps)
  - [ ] Leaflet + OpenStreetMap на фронтенде (требует реализации на фронтенде)
  - [ ] Виджеты Yandex Maps и Google Maps для выбора координат (требует реализации на фронтенде)

### Системный администратор

- [x] Создание и настройка брендов
- [x] Создание кофеен в франшизе
- [x] Добавление админов кофейни
- [x] Управление системными настройками
  - ✅ Модель SystemSettings в Prisma
  - ✅ CRUD операции для системных настроек (SYSTEM_ADMIN only)
  - ✅ Настройки платформы (комиссия, лимиты)
  - ✅ Настройки безопасности (время жизни токенов, требования к паролям)
  - ✅ Настройки модерации (автомодерация, требования к документам)
  - ✅ Настройки уведомлений (email, SMS, push)
  - ✅ Настройки интеграций (Stripe, картографические сервисы)
  - ✅ Настройки лимитов (размер файлов, количество документов)
  - ✅ E2E тесты для всех эндпоинтов

### Администратор бренда

- [ ] Просмотр статистики по бренду
- [ ] Управление кофейнями бренда
- [ ] Отчеты по бренду
- [ ] Экспорт отчетов (docx, excel, pdf, csv)

### Заказы и бронирования

- [ ] Создание заказов
- [ ] Управление статусами заказов
- [ ] История заказов пользователя

### Отзывы

- [ ] Создание отзывов о кофейне
- [ ] Просмотр отзывов
- [ ] Расчет рейтинга кофейни

### API для мобильного приложения

- [ ] Эндпоинты для регистрации/авторизации
- [ ] Эндпоинты для работы с профилем
- [ ] Эндпоинты для поиска кофеен
- [ ] Эндпоинты для бронирований
- [ ] Эндпоинты для работы с балансом

### Фронтенд (Next.js)

- [ ] Страницы для системного админа
- [ ] Страницы для админа бренда
- [ ] Аутентификация на фронтенде
- [ ] Дашборды и отчеты
