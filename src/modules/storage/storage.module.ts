import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageTestController } from './storage-test.controller';

@Module({
  imports: [ConfigModule],
  controllers: [StorageTestController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
