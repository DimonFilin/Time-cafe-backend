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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
