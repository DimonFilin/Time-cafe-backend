# Новый флоу аутентификации (Lookup/Select)

## Описание

Реализован новый двухэтапный флоу аутентификации, который позволяет пользователям выбирать между несколькими аккаунтами (User и WorkerAccount), если у них один email связан с несколькими ролями.

## Эндпоинты

### 1. POST /auth/login/lookup

**Назначение**: Проверяет email и пароль, возвращает список доступных аккаунтов для выбора.

**Вход**:

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Выход**:

```json
{
  "accounts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "displayName": "John Doe",
      "role": "USER",
      "brandId": null,
      "cafeId": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "displayName": "John Doe",
      "role": "BRAND_ADMIN",
      "brandId": "550e8400-e29b-41d4-a716-446655440002",
      "cafeId": null
    }
  ],
  "lookupToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ..."
}
```

**Логика**:

1. Проверяет email и пароль в Keycloak
2. Получает keycloakId из токена
3. Ищет все аккаунты с этим keycloakId:
   - User аккаунт (если существует)
   - Все WorkerAccount аккаунты (если существуют)
4. Возвращает список аккаунтов с их ролями и связанными данными (brandId, cafeId)
5. Возвращает временный lookupToken (refresh token) для следующего шага

**Коды ответа**:

- `200` - Успешно, список аккаунтов возвращен
- `401` - Неверные учетные данные
- `400` - Неверный формат данных

---

### 2. POST /auth/login/select

**Назначение**: Выбирает аккаунт из списка и создает сессию, возвращает access и refresh токены.

**Вход**:

```json
{
  "accountId": "550e8400-e29b-41d4-a716-446655440001",
  "lookupToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ..."
}
```

**Выход**:

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ...",
  "expiresIn": 900,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "avatar": null,
    "balance": "0.00",
    "createdAt": "2025-01-11T00:00:00.000Z"
  }
}
```

**Логика**:

1. Использует lookupToken (refresh token) для получения нового access token
2. Проверяет, что accountId принадлежит тому же keycloakId, что и lookupToken
3. Находит выбранный аккаунт (User или WorkerAccount)
4. Возвращает новые токены и данные профиля выбранного аккаунта

**Коды ответа**:

- `200` - Успешно, токены возвращены
- `400` - Неверный accountId или аккаунт не принадлежит пользователю
- `401` - Неверный или истекший lookupToken

---

### 3. GET /auth/me (обновлен)

**Назначение**: Возвращает данные текущего аккаунта с информацией о роли.

**Заголовки**:

```
Authorization: Bearer <accessToken>
```

**Выход**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "avatar": null,
  "balance": "0.00",
  "createdAt": "2025-01-11T00:00:00.000Z",
  "role": "BRAND_ADMIN",
  "brandId": "550e8400-e29b-41d4-a716-446655440002",
  "cafeId": null
}
```

**Логика**:

1. Извлекает keycloakId из JWT токена
2. Проверяет наличие WorkerAccount (приоритет)
3. Если WorkerAccount не найден, проверяет User аккаунт
4. Возвращает данные аккаунта с ролью и связанными данными

**Роли**:

- `USER` - обычный пользователь (User аккаунт)
- `SYSTEM_ADMIN` - системный администратор
- `BRAND_ADMIN` - администратор бренда
- `CAFE_ADMIN` - администратор кофейни
- `WORKER` - работник кофейни

**Коды ответа**:

- `200` - Успешно, данные аккаунта возвращены
- `401` - Не авторизован или аккаунт не найден

---

## Пример использования

### Сценарий 1: Пользователь с одним аккаунтом (User)

```typescript
// Шаг 1: Lookup
const lookupResponse = await fetch('/auth/login/lookup', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123!',
  }),
});

const { accounts, lookupToken } = await lookupResponse.json();
// accounts: [{ id: "...", role: "USER", ... }]

// Шаг 2: Select (автоматически, если только один аккаунт)
const selectResponse = await fetch('/auth/login/select', {
  method: 'POST',
  body: JSON.stringify({
    accountId: accounts[0].id,
    lookupToken,
  }),
});

const { accessToken, refreshToken } = await selectResponse.json();

// Шаг 3: Использование токена
const meResponse = await fetch('/auth/me', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

### Сценарий 2: Пользователь с несколькими аккаунтами

```typescript
// Шаг 1: Lookup
const lookupResponse = await fetch('/auth/login/lookup', {
  method: 'POST',
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'Password123!',
  }),
});

const { accounts, lookupToken } = await lookupResponse.json();
// accounts: [
//   { id: "...", role: "USER", ... },
//   { id: "...", role: "BRAND_ADMIN", brandId: "...", ... }
// ]

// Шаг 2: Пользователь выбирает аккаунт (например, BRAND_ADMIN)
const selectedAccount = accounts.find((a) => a.role === 'BRAND_ADMIN');

const selectResponse = await fetch('/auth/login/select', {
  method: 'POST',
  body: JSON.stringify({
    accountId: selectedAccount.id,
    lookupToken,
  }),
});

const { accessToken, refreshToken } = await selectResponse.json();

// Шаг 3: GET /auth/me вернет данные BRAND_ADMIN аккаунта
```

---

## Безопасность

1. **LookupToken**: Используется refresh token от Keycloak, который имеет ограниченное время жизни
2. **Валидация accountId**: Проверяется, что выбранный аккаунт принадлежит тому же keycloakId, что и lookupToken
3. **Одноразовость**: lookupToken можно использовать только один раз для получения новых токенов
4. **HTTPS**: Рекомендуется использовать HTTPS в продакшене

---

## Миграция со старого флоу

Старый эндпоинт `POST /auth/login` продолжает работать для обратной совместимости. Новый флоу рекомендуется использовать для:

- Приложений с поддержкой множественных ролей
- Улучшенного UX при выборе аккаунта
- Более безопасной аутентификации
