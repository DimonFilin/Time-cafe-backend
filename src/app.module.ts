import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkersModule } from './modules/workers/workers.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CafesModule } from './modules/cafes/cafes.module';
import { SystemAdminModule } from './modules/system-admin/system-admin.module';
import { BrandAdminModule } from './modules/brand-admin/brand-admin.module';
import { SystemModule } from './modules/system/system.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StorageModule } from './modules/storage/storage.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { RegionsModule } from './modules/regions/regions.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkersModule,
    BrandsModule,
    CafesModule,
    SystemAdminModule,
    BrandAdminModule,
    SystemModule,
    PaymentsModule,
    StorageModule,
    SystemSettingsModule,
    OrdersModule,
    ReviewsModule,
    AppointmentsModule,
    RegionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
