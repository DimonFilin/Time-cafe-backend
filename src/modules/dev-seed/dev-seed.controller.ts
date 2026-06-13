import { Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'nest-keycloak-connect';
import { DevSeedGuard } from './dev-seed.guard';
import { DevSeedService } from './dev-seed.service';
import { KeycloakUsersBatchDto } from './dto/keycloak-users.dto';

@ApiTags('Dev Seed')
@Controller('dev/seed')
@Public()
@UseGuards(DevSeedGuard)
@ApiHeader({ name: 'X-Dev-Seed-Secret', required: true })
export class DevSeedController {
  constructor(private readonly devSeedService: DevSeedService) {}

  @Post('clear-database')
  @ApiOperation({ summary: 'Clear all application tables (dev only)' })
  clearDatabase() {
    return this.devSeedService.clearDatabase();
  }

  @Post('clear-keycloak')
  @ApiOperation({ summary: 'Clear demo Keycloak users (dev only)' })
  clearKeycloak(@Query('all') all?: string) {
    return this.devSeedService.clearKeycloak(all === 'true');
  }

  @Post('keycloak/users')
  @ApiOperation({ summary: 'Create or update Keycloak users (dev only)' })
  createKeycloakUsers(@Body() dto: KeycloakUsersBatchDto) {
    return this.devSeedService.createKeycloakUsers(dto.users);
  }
}
