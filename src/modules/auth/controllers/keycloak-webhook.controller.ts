import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { Public } from 'nest-keycloak-connect';
import { KeycloakWebhookService } from '../services/keycloak-webhook.service';

interface KeycloakWebhookPayload {
  type: string;
  realmId: string;
  userId?: string;
  details?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: unknown;
  };
}

@ApiTags('Auth')
@Controller('auth/webhook')
export class KeycloakWebhookController {
  private readonly logger = new Logger(KeycloakWebhookController.name);

  constructor(private readonly webhookService: KeycloakWebhookService) {}

  @Post('keycloak')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Keycloak webhook endpoint',
    description: 'Receives events from Keycloak and syncs user data to Prisma',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  async handleKeycloakWebhook(
    @Body() payload: KeycloakWebhookPayload,
  ): Promise<{ status: string }> {
    // В продакшене нужно проверять подпись webhook для безопасности
    // const isValid = this.verifyWebhookSignature(payload, signature);
    // if (!isValid) {
    //   throw new UnauthorizedException('Invalid webhook signature');
    // }

    this.logger.log(
      `Received Keycloak webhook: ${payload.type} for user ${payload.userId}`,
    );

    try {
      await this.webhookService.handleUserEvent(payload);
      return { status: 'ok' };
    } catch (error: unknown) {
      this.logger.error('Failed to process Keycloak webhook', error);
      throw error;
    }
  }

  // private verifyWebhookSignature(
  //   payload: unknown,
  //   signature: string | undefined,
  // ): boolean {
  //   // Реализовать проверку подписи webhook
  //   // Keycloak может отправлять подпись в заголовке
  //   return true;
  // }
}
