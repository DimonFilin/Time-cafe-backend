import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { DevSeedController } from './dev-seed.controller';
import { DevSeedService } from './dev-seed.service';
import { DevSeedGuard } from './dev-seed.guard';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [DevSeedController],
  providers: [DevSeedService, DevSeedGuard],
})
export class DevSeedModule {}
