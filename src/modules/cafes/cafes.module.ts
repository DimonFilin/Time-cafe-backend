import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CafesController } from './cafes.controller';
import { CafesService } from './cafes.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { KeycloakModule } from '../auth/keycloak.module';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [
    PrismaModule,
    KeycloakModule,
    WorkersModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [CafesController],
  providers: [CafesService],
  exports: [CafesService],
})
export class CafesModule {}
