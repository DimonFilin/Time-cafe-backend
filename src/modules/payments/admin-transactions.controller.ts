import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { TransactionsService } from './services/transactions.service';
import { WorkersService } from '../workers/workers.service';
import { WorkerRole, Transaction } from '@prisma/client';
import { AdminTransactionListQueryDto } from './dto/admin-transaction-list-query.dto';
import { AdminTransactionListResponseDto } from './dto/admin-transaction-list-response.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';

@ApiTags('Admin Transactions')
@Controller('admin/transactions')
export class AdminTransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly workersService: WorkersService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all transactions (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'List of transactions',
    type: AdminTransactionListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  async findAll(
    @Query() query: AdminTransactionListQueryDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AdminTransactionListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can view transactions');
    }

    const result = await this.transactionsService.findAllAdmin(query);
    return {
      items: result.items.map((t) => this.mapTransactionToDto(t)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get transaction by ID (SYSTEM_ADMIN only)' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<TransactionResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can view transactions');
    }

    const transaction = await this.transactionsService.findOneAdmin(id);
    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    return this.mapTransactionToDto(transaction);
  }

  @Post(':id/refund')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create refund for transaction (SYSTEM_ADMIN only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Refund created successfully',
    type: TransactionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - SYSTEM_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async createRefund(
    @Param('id') id: string,
    @Body() body: { amount?: number; description?: string },
    @Request() req: { user?: { sub?: string } },
  ): Promise<TransactionResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker || worker.role !== WorkerRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('Only SYSTEM_ADMIN can create refunds');
    }

    const refund = await this.transactionsService.createRefundAdmin(
      id,
      body.amount,
      body.description,
    );

    const transaction = await this.transactionsService.findOneAdmin(refund.id);
    if (!transaction) {
      throw new BadRequestException('Refund transaction not found');
    }

    return this.mapTransactionToDto(transaction);
  }

  private mapTransactionToDto(
    transaction: Transaction,
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
