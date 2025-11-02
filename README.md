# Time Cafe - Shared Service

Общий сервис для управления системой Time Cafe. Включает в себя API для мобильного приложения и Next.js фронтенд для административных панелей.

## Технологии

- NestJS - Backend фреймворк
- Next.js - Frontend фреймворк
- TypeORM - ORM для работы с БД
- PostgreSQL - База данных
- Swagger - Документация API

## Установка

```bash
npm install
```

## Настройка

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Заполните необходимые переменные окружения.

## Запуск

### Разработка

Запуск API и Frontend одновременно:
```bash
npm run start:dev
```

Или раздельно:
```bash
# API на порту 3000
npm run start:api

# Frontend на порту 3000
npm run start:frontend
```

### Production

```bash
npm run build
npm run start:prod
```

## API Документация

После запуска сервера документация Swagger доступна по адресу:
- http://localhost:3000/api/docs

## Структура модулей

- `auth` - Аутентификация и авторизация
- `users` - Управление пользователями
- `brands` - Управление брендами
- `cafes` - Управление кофейнями
- `system-admin` - Функционал системного администратора
- `brand-admin` - Функционал администратора бренда
