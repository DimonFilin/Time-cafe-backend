import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CafeRealtimeGateway } from './cafe-realtime.gateway';

@Module({
  imports: [PrismaModule],
  providers: [CafeRealtimeGateway],
  exports: [CafeRealtimeGateway],
})
export class CafeRealtimeModule {}
