import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderListQueryDto } from './dto/order-list-query.dto';
import { OrderListResponseDto } from './dto/order-list-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create order',
    description: 'Create a new order. Requires authentication.',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cafe or appointment not found' })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<OrderResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.ordersService.create(keycloakId, createOrderDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user orders',
    description:
      'Get list of orders for the authenticated user with filtering and pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of orders',
    type: OrderListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query() query: OrderListQueryDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<OrderListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.ordersService.findAll(keycloakId, query);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Get order details by ID. User can only access their own orders.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order details',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<OrderResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.ordersService.findOne(id, keycloakId);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel order',
    description: 'Cancel order. User can only cancel their own pending orders.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - order cannot be cancelled',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancel(
    @Param('id') id: string,
    @Body() cancelDto: CancelOrderDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<OrderResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.ordersService.cancel(id, keycloakId, cancelDto.reason);
  }

  @Get('cafe/:cafeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get cafe orders (for workers)',
    description:
      'Get list of orders for a specific cafe. Only CAFE_ADMIN, WORKER of the cafe, or SYSTEM_ADMIN can access.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of cafe orders',
    type: OrderListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async findCafeOrders(
    @Param('cafeId') cafeId: string,
    @Query() query: OrderListQueryDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<OrderListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.ordersService.findCafeOrders(cafeId, keycloakId, query);
  }

  @Get('cafe/:cafeId/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get cafe order by ID (for workers)',
    description:
      'Get order details by ID for a specific cafe. Only CAFE_ADMIN, WORKER of the cafe, or SYSTEM_ADMIN can access.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order details',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findCafeOrder(
    @Param('cafeId') cafeId: string,
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<OrderResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.ordersService.findCafeOrder(id, keycloakId);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update order status (for workers)',
    description:
      'Update order status. Only CAFE_ADMIN, WORKER of the cafe, or SYSTEM_ADMIN can update.',
  })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid status transition',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderStatusDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<OrderResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.ordersService.updateStatus(id, keycloakId, updateDto);
  }
}
