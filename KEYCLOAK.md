# Keycloak Integration

## Быстрый старт

### 1. Запуск Keycloak

```bash
cd backend-shared
docker-compose up -d
```

**Доступ:** http://localhost:8080 (admin/admin)

### 2. Настройка в Keycloak

1. Создайте Realm: `time-cafe-shared`
2. Создайте Client:
   - Client ID: `backend-shared-api`
   - Access Type: `confidential`
   - Client authentication: `On`
   - Valid Redirect URIs: `http://localhost:3000/*`
3. Скопируйте Client Secret из вкладки Credentials

### 3. Переменные окружения

Добавьте в `.env`:

```env
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=time-cafe-shared
KEYCLOAK_CLIENT_ID=backend-shared-api
KEYCLOAK_CLIENT_SECRET=your-secret-here
```

## Тестовые endpoints

- `GET /auth-test/public` - публичный endpoint
- `GET /auth-test/protected` - требует валидный токен
- `GET /auth-test/keycloak-ping` - проверка доступности Keycloak

## Получение токена

```bash
curl -X POST http://localhost:8080/realms/time-cafe-shared/protocol/openid-connect/token \
  -d "client_id=backend-shared-api" \
  -d "client_secret=YOUR_SECRET" \
  -d "grant_type=client_credentials"
```

## Полезные команды

```bash
# Логи Keycloak
docker-compose logs -f keycloak

# Остановка
docker-compose down
```
