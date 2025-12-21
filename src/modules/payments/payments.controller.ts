import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  Query,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentCardsService } from './services/payment-cards.service';
import { TransactionsService } from './services/transactions.service';
import { UsersService } from '../users/users.service';
import { AddCardDto } from './dto/add-card.dto';
import { CreatePaymentDto } from './dto/payment.dto';
import { CardResponseDto } from './dto/card-response.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { Transaction } from '@prisma/client';

@ApiTags('Payments')
@Controller('users')
export class PaymentsController {
  constructor(
    private readonly paymentCardsService: PaymentCardsService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('cards')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get user payment cards',
    description:
      'Returns list of active payment cards for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment cards retrieved successfully',
    type: [CardResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCards(
    @Request() req: { user?: { sub?: string } },
  ): Promise<CardResponseDto[]> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = await this.getUserIdFromKeycloakId(keycloakId);
    const cards = await this.paymentCardsService.findByUserId(userId);

    return cards.map((card) => ({
      id: card.id,
      last4Digits: card.last4Digits,
      cardType: card.cardType,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      isDefault: card.isDefault,
      isActive: card.isActive,
      holderName: card.holderName ?? undefined,
      createdAt: card.createdAt,
    }));
  }

  @Post('cards')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add payment card',
    description:
      'Adds a new payment card for the authenticated user (simulated Stripe integration)',
  })
  @ApiResponse({
    status: 201,
    description: 'Card added successfully',
    type: CardResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid card data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addCard(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: AddCardDto,
  ): Promise<CardResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = await this.getUserIdFromKeycloakId(keycloakId);

    const card = await this.paymentCardsService.validateAndAddCard(
      userId,
      dto.cardNumber,
      dto.expiryMonth,
      dto.expiryYear,
      dto.cvv,
      dto.holderName,
    );

    return {
      id: card.id,
      last4Digits: card.last4Digits,
      cardType: card.cardType,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      isDefault: card.isDefault,
      isActive: card.isActive,
      holderName: card.holderName ?? undefined,
      createdAt: card.createdAt,
    };
  }

  @Delete('cards/:id')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete payment card',
    description: 'Soft deletes a payment card for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Card deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async deleteCard(
    @Request() req: { user?: { sub?: string } },
    @Param('id') cardId: string,
  ): Promise<{ message: string }> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = await this.getUserIdFromKeycloakId(keycloakId);
    await this.paymentCardsService.deleteCard(cardId, userId);

    return { message: 'Card deleted successfully' };
  }

  @Patch('cards/:id/set-default')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set default card',
    description: 'Sets a payment card as default for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Card set as default successfully',
    type: CardResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async setDefaultCard(
    @Request() req: { user?: { sub?: string } },
    @Param('id') cardId: string,
  ): Promise<CardResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = await this.getUserIdFromKeycloakId(keycloakId);
    const card = await this.paymentCardsService.setDefaultCard(cardId, userId);

    return {
      id: card.id,
      last4Digits: card.last4Digits,
      cardType: card.cardType,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      isDefault: card.isDefault,
      isActive: card.isActive,
      holderName: card.holderName ?? undefined,
      createdAt: card.createdAt,
    };
  }

  @Post('payments')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create payment',
    description:
      'Creates a payment transaction using a payment card (simulated Stripe)',
  })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payment data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async createPayment(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: CreatePaymentDto,
  ): Promise<TransactionResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = await this.getUserIdFromKeycloakId(keycloakId);

    const transaction = await this.transactionsService.createPayment(
      userId,
      dto.cardId,
      dto.amount,
      dto.orderId,
      dto.description,
    );

    return this.mapTransactionToDto(transaction);
  }

  @Get('transactions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get transaction history',
    description: 'Returns transaction history for the authenticated user',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of transactions to return (default: 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of transactions to skip (default: 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
    type: [TransactionResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTransactions(
    @Request() req: { user?: { sub?: string } },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<TransactionResponseDto[]> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = await this.getUserIdFromKeycloakId(keycloakId);
    const transactions = await this.transactionsService.findByUserId(
      userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );

    return transactions.map((t) => this.mapTransactionToDto(t));
  }

  @Get('transactions/:id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get transaction details',
    description: 'Returns details of a specific transaction',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(
    @Request() req: { user?: { sub?: string } },
    @Param('id') transactionId: string,
  ): Promise<TransactionResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = await this.getUserIdFromKeycloakId(keycloakId);
    const transaction = await this.transactionsService.findById(
      transactionId,
      userId,
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.mapTransactionToDto(transaction);
  }

  @Post('transactions/:id/refund')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create refund',
    description: 'Creates a refund transaction for a completed payment',
  })
  @ApiResponse({
    status: 201,
    description: 'Refund created successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid refund data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async createRefund(
    @Request() req: { user?: { sub?: string } },
    @Param('id') transactionId: string,
    @Body() body?: { amount?: number; description?: string },
  ): Promise<TransactionResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userId = await this.getUserIdFromKeycloakId(keycloakId);

    const transaction = await this.transactionsService.createRefund(
      userId,
      transactionId,
      body?.amount,
      body?.description,
    );

    return this.mapTransactionToDto(transaction);
  }

  private async getUserIdFromKeycloakId(keycloakId: string): Promise<string> {
    const user = await this.usersService.findByKeycloakId(keycloakId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.id;
  }

  private mapTransactionToDto(
    transaction: Transaction & {
      card?: { id: string; last4Digits: string; cardType: string } | null;
    },
  ): TransactionResponseDto {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      orderId: transaction.orderId ?? undefined,
      cardId: transaction.cardId ?? undefined,
      provider: transaction.provider ?? undefined,
      providerTransactionId: transaction.providerTransactionId ?? undefined,
      description: transaction.description ?? undefined,
      createdAt: transaction.createdAt,
    };
  }
}
