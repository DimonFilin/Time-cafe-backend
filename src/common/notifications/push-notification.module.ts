import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PushNotificationService } from './push-notification.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
