# Activity Logs Module

Модуль для логирования действий работников (WorkerAccount) в системе.

## Что логируется

- ✅ Логин/логаут работников
- ✅ Создание/изменение/удаление данных
- ✅ Просмотр важных разделов
- ✅ Изменение настроек
- ✅ Финансовые операции
- ✅ Загрузка/удаление файлов

## Использование

### 1. Автоматическое логирование через декоратор

Самый простой способ - использовать декоратор `@LogActivity`:

```typescript
import { LogActivity } from '../../common/decorators/log-activity.decorator';
import { ActivityAction, ActivityCategory } from '@prisma/client';

@Controller('orders')
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private activityLogsService: ActivityLogsService, // Обязательно инжектить!
  ) {}

  @Post()
  @LogActivity(ActivityAction.CREATE, ActivityCategory.DATA, {
    resourceType: 'ORDER',
    getResourceId: (result) => result.id,
    getDetails: (result) => ({
      orderNumber: result.orderNumber,
      totalAmount: result.totalAmount,
      status: result.status,
    }),
  })
  async createOrder(@Body() dto: CreateOrderDto, @Request() req) {
    return this.ordersService.create(dto);
  }

  @Patch(':id')
  @LogActivity(ActivityAction.UPDATE, ActivityCategory.DATA, {
    resourceType: 'ORDER',
    getResourceId: (result) => result.id,
    getDetails: (result, req) => ({
      orderId: req.params.id,
      changes: req.body,
    }),
  })
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @Request() req,
  ) {
    return this.ordersService.update(id, dto);
  }

  @Delete(':id')
  @LogActivity(ActivityAction.DELETE, ActivityCategory.DATA, {
    resourceType: 'ORDER',
    getResourceId: (result, req) => req.params.id,
  })
  async deleteOrder(@Param('id') id: string, @Request() req) {
    return this.ordersService.delete(id);
  }
}
```

### 2. Ручное логирование

Для более сложных случаев можно логировать вручную:

```typescript
@Injectable()
export class BrandsService {
  constructor(
    private prisma: PrismaService,
    private activityLogsService: ActivityLogsService,
  ) {}

  async updateSettings(brandId: string, settings: any, user: any) {
    // Получаем старые настройки
    const oldSettings = await this.getSettings(brandId);

    // Обновляем
    const result = await this.prisma.brand.update({
      where: { id: brandId },
      data: { settings },
    });

    // Логируем изменения
    await this.activityLogsService.log({
      workerId: user.workerId,
      workerEmail: user.email,
      workerRole: user.role,
      brandId,
      action: ActivityAction.UPDATE_SETTINGS,
      category: ActivityCategory.CONFIG,
      severity: LogSeverity.WARNING, // Важное действие
      resourceType: 'BRAND',
      resourceId: brandId,
      details: {
        oldSettings,
        newSettings: settings,
        changedFields: this.getChangedFields(oldSettings, settings),
      },
    });

    return result;
  }
}
```

### 3. Логирование в AuthService (уже реализовано)

Логин работника логируется автоматически в `auth.service.ts`:

```typescript
// В методе loginSelect после успешного выбора аккаунта
await this.activityLogsService.log({
  workerId: workerAccount.id,
  workerEmail: workerAccount.email,
  workerRole: workerAccount.role,
  brandId: workerAccount.brandId || undefined,
  cafeId: workerAccount.cafeId || undefined,
  action: ActivityAction.LOGIN,
  category: ActivityCategory.AUTH,
  severity: LogSeverity.INFO,
  resourceType: 'WORKER_ACCOUNT',
  resourceId: workerAccount.id,
  details: {
    loginMethod: 'select',
    role: workerAccount.role,
    brandName: workerAccount.brand?.name,
    cafeName: workerAccount.cafe?.name,
  },
});
```

## API Endpoints

### GET /activity-logs

Получить логи с фильтрацией:

```bash
# Все логи (для SYSTEM_ADMIN)
GET /activity-logs?page=1&limit=50

# Логи конкретного работника
GET /activity-logs?workerId=xxx

# Логи бренда (автоматически для BRAND_ADMIN)
GET /activity-logs?brandId=xxx

# Логи кафе (автоматически для CAFE_ADMIN)
GET /activity-logs?cafeId=xxx

# Фильтр по действию
GET /activity-logs?action=CREATE

# Фильтр по категории
GET /activity-logs?category=AUTH

# Фильтр по дате
GET /activity-logs?startDate=2026-01-01&endDate=2026-01-31

# Комбинированные фильтры
GET /activity-logs?brandId=xxx&action=UPDATE&startDate=2026-01-01
```

### GET /activity-logs/statistics

Получить статистику:

```bash
GET /activity-logs/statistics?brandId=xxx&startDate=2026-01-01
```

Ответ:

```json
{
  "byAction": [
    { "action": "LOGIN", "_count": 150 },
    { "action": "CREATE", "_count": 45 },
    { "action": "UPDATE", "_count": 30 }
  ],
  "byCategory": [
    { "category": "AUTH", "_count": 150 },
    { "category": "DATA", "_count": 75 }
  ],
  "bySeverity": [
    { "severity": "INFO", "_count": 200 },
    { "severity": "WARNING", "_count": 25 }
  ]
}
```

## Добавление в модуль

Чтобы использовать логирование в своем модуле:

```typescript
import { Module } from '@nestjs/common';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    ActivityLogsModule, // Добавить импорт
    // ... другие модули
  ],
  controllers: [YourController],
  providers: [YourService],
})
export class YourModule {}
```

И инжектить сервис:

```typescript
constructor(
  private activityLogsService: ActivityLogsService,
) {}
```

## Enums

### ActivityAction

- `LOGIN` - Вход в систему
- `LOGOUT` - Выход из системы
- `PASSWORD_CHANGE` - Смена пароля
- `TOKEN_REFRESH` - Обновление токена
- `CREATE` - Создание записи
- `UPDATE` - Обновление записи
- `DELETE` - Удаление записи
- `BULK_UPDATE` - Массовое обновление
- `BULK_DELETE` - Массовое удаление
- `VIEW_LIST` - Просмотр списка
- `VIEW_DETAIL` - Просмотр деталей
- `VIEW_REPORT` - Просмотр отчета
- `EXPORT_DATA` - Экспорт данных
- `UPDATE_SETTINGS` - Изменение настроек
- `UPDATE_PERMISSIONS` - Изменение прав
- `FILE_UPLOAD` - Загрузка файла
- `FILE_DELETE` - Удаление файла
- `PAYMENT_PROCESS` - Обработка платежа

### ActivityCategory

- `AUTH` - Аутентификация
- `DATA` - Работа с данными
- `VIEW` - Просмотр
- `CONFIG` - Конфигурация
- `FINANCIAL` - Финансовые операции
- `SECURITY` - Безопасность

### LogSeverity

- `INFO` - Информационное сообщение
- `WARNING` - Предупреждение (важное действие)
- `CRITICAL` - Критическое действие

## Права доступа

- **SYSTEM_ADMIN** - видит все логи
- **BRAND_ADMIN** - видит только логи своего бренда
- **CAFE_ADMIN** - видит только логи своего кафе

Фильтрация применяется автоматически в контроллере.

## Что дальше

1. ✅ Базовая структура создана
2. ✅ Логирование логина работников
3. ✅ Декоратор для удобного использования
4. ✅ API endpoints для просмотра логов
5. ⏳ Добавить логирование в остальные контроллеры
6. ⏳ Создать cleanup service для удаления старых логов
7. ⏳ Добавить frontend для просмотра логов
8. ⏳ Добавить экспорт в CSV
9. ⏳ Добавить real-time уведомления

## Примеры для разных модулей

### Orders

```typescript
@LogActivity(ActivityAction.CREATE, ActivityCategory.DATA, {
  resourceType: 'ORDER',
  getResourceId: (result) => result.id,
})
```

### Cafes

```typescript
@LogActivity(ActivityAction.UPDATE, ActivityCategory.DATA, {
  resourceType: 'CAFE',
  getResourceId: (result) => result.id,
})
```

### Brands

```typescript
@LogActivity(ActivityAction.UPDATE_SETTINGS, ActivityCategory.CONFIG, {
  resourceType: 'BRAND',
  getResourceId: (result) => result.id,
  severity: LogSeverity.WARNING,
})
```

### Payments

```typescript
@LogActivity(ActivityAction.PAYMENT_PROCESS, ActivityCategory.FINANCIAL, {
  resourceType: 'TRANSACTION',
  getResourceId: (result) => result.id,
  severity: LogSeverity.WARNING,
})
```

### Storage

```typescript
@LogActivity(ActivityAction.FILE_UPLOAD, ActivityCategory.DATA, {
  resourceType: 'FILE',
  getResourceId: (result) => result.fileId,
})
```
