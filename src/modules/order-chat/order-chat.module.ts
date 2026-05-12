import { Module } from '@nestjs/common';
import { KeycloakModule } from '../auth/keycloak.module';
import { StorageModule } from '../storage/storage.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { OrderChatController } from './order-chat.controller';
import { OrderChatGateway } from './order-chat.gateway';
import { OrderChatService } from './order-chat.service';

@Module({
  imports: [KeycloakModule, StorageModule, ActivityLogsModule],
  controllers: [OrderChatController],
  providers: [OrderChatService, OrderChatGateway],
  exports: [OrderChatService],
})
export class OrderChatModule {}
