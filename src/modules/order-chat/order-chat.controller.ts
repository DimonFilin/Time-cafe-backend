import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrderChatService } from './order-chat.service';
import { OrderChatGateway } from './order-chat.gateway';
import {
  ChatListQueryDto,
  MarkChatReadDto,
  SendChatMessageDto,
  UpdateChatSettingsDto,
} from './dto';

@ApiTags('Order Chats')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('order-chats')
export class OrderChatController {
  constructor(
    private readonly orderChatService: OrderChatService,
    private readonly orderChatGateway: OrderChatGateway,
  ) {}

  private async actorFromReq(req: { user?: { sub?: string } }) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.orderChatService.resolveActorByKeycloakId(keycloakId);
  }

  @Get()
  @ApiOperation({ summary: 'List chats for current account' })
  async list(
    @Req() req: { user?: { sub?: string } },
    @Query() query: ChatListQueryDto,
  ) {
    const actor = await this.actorFromReq(req);
    return this.orderChatService.list(actor, query);
  }

  @Get('by-order/:orderId')
  @ApiOperation({ summary: 'Get/create chat for order' })
  async byOrder(
    @Req() req: { user?: { sub?: string } },
    @Param('orderId') orderId: string,
  ) {
    const actor = await this.actorFromReq(req);
    return this.orderChatService.getOrCreateByOrder(orderId, actor);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Get chat messages' })
  async getMessages(
    @Req() req: { user?: { sub?: string } },
    @Param('chatId') chatId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const actor = await this.actorFromReq(req);
    return this.orderChatService.getMessages(
      chatId,
      actor,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Post(':chatId/messages')
  @ApiOperation({ summary: 'Send chat message' })
  async sendMessage(
    @Req() req: { user?: { sub?: string } },
    @Param('chatId') chatId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    const actor = await this.actorFromReq(req);
    const result = await this.orderChatService.sendMessage(chatId, actor, dto);
    this.orderChatGateway.emitMessageCreated(chatId, result);
    return result.message;
  }

  @Get(':chatId/attachments/:attachmentId/file')
  @ApiOperation({
    summary:
      'Stream chat attachment image (mobile: avoids presigned localhost / admin media-s3 proxy URLs)',
  })
  async streamAttachment(
    @Req() req: { user?: { sub?: string } },
    @Param('chatId') chatId: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const actor = await this.actorFromReq(req);
    const { data, contentType } =
      await this.orderChatService.streamAttachmentFile(
        chatId,
        attachmentId,
        actor,
      );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(data);
  }

  @Post(':chatId/uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload chat image attachment' })
  async upload(
    @Req() req: { user?: { sub?: string } },
    @Param('chatId') chatId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          size: number;
          originalname?: string;
        }
      | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const actor = await this.actorFromReq(req);
    return this.orderChatService.uploadAttachment(chatId, actor, file);
  }

  @Post(':chatId/messages/:id/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  async markRead(
    @Req() req: { user?: { sub?: string } },
    @Param('chatId') chatId: string,
    @Param('id') messageId: string,
    @Body() dto: MarkChatReadDto,
  ) {
    const actor = await this.actorFromReq(req);
    return this.orderChatService.markRead(chatId, actor, {
      messageId: dto.messageId || messageId,
    });
  }

  @Patch(':chatId/settings')
  @ApiOperation({ summary: 'Update chat settings' })
  async updateSettings(
    @Req() req: { user?: { sub?: string } },
    @Param('chatId') chatId: string,
    @Body() dto: UpdateChatSettingsDto,
  ) {
    const actor = await this.actorFromReq(req);
    return this.orderChatService.updateSettings(chatId, actor, dto);
  }
}
