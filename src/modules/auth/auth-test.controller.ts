import { Controller, Get, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Resource, Public } from 'nest-keycloak-connect';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@ApiTags('Auth Test')
@Controller('auth-test')
@Resource('auth-test')
export class AuthTestController {
  constructor(private readonly httpService: HttpService) {}

  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'Public endpoint',
    description: 'Public endpoint without authentication.',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  getPublic() {
    return {
      message: 'Public endpoint - no authentication required',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('protected')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Protected endpoint',
    description: 'Protected endpoint that requires valid Keycloak token.',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProtected(@Request() req: { user?: { azp?: string } }) {
    return {
      message: 'Protected endpoint - authentication successful',
      authenticated: !!req.user,
      clientId: req.user?.azp || null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('keycloak-ping')
  @Public()
  @ApiOperation({
    summary: 'Keycloak connectivity check',
    description: 'Check if Keycloak server is accessible.',
  })
  @ApiResponse({ status: 200, description: 'Keycloak is accessible' })
  @ApiResponse({ status: 503, description: 'Keycloak is not accessible' })
  async keycloakPing() {
    try {
      const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
      const realm = process.env.KEYCLOAK_REALM || 'master';
      await firstValueFrom(
        this.httpService.get(
          `${keycloakUrl}/realms/${realm}/.well-known/openid-configuration`,
        ),
      );
      return {
        status: 'ok',
        keycloakUrl,
        realm,
        accessible: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      return {
        status: 'error',
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
