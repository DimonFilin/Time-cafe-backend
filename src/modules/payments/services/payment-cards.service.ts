import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentCard } from '@prisma/client';

@Injectable()
export class PaymentCardsService {
  private readonly logger = new Logger(PaymentCardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<PaymentCard[]> {
    return this.prisma.paymentCard.findMany({
      where: {
        userId,
        deletedAt: null,
        isActive: true,
      },
      orderBy: {
        isDefault: 'desc',
      },
    });
  }

  async findById(cardId: string, userId: string): Promise<PaymentCard | null> {
    return this.prisma.paymentCard.findFirst({
      where: {
        id: cardId,
        userId,
        deletedAt: null,
        isActive: true,
      },
    });
  }

  async addCard(
    userId: string,
    data: {
      last4Digits: string;
      cardType: string;
      expiryMonth: number;
      expiryYear: number;
      holderName?: string;
    },
  ): Promise<PaymentCard> {
    const providerToken = `card_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const isFirstCard = (await this.findByUserId(userId)).length === 0;

    const card = await this.prisma.paymentCard.create({
      data: {
        userId,
        last4Digits: data.last4Digits,
        cardType: data.cardType,
        expiryMonth: data.expiryMonth,
        expiryYear: data.expiryYear,
        holderName: data.holderName,
        providerToken,
        isDefault: isFirstCard,
        isActive: true,
      },
    });

    this.logger.log(`Card added for user ${userId}: ${card.id}`);
    return card;
  }

  async setDefaultCard(cardId: string, userId: string): Promise<PaymentCard> {
    const card = await this.findById(cardId, userId);
    if (!card) {
      throw new NotFoundException('Payment card not found');
    }

    await this.prisma.paymentCard.updateMany({
      where: {
        userId,
        deletedAt: null,
      },
      data: {
        isDefault: false,
      },
    });

    return this.prisma.paymentCard.update({
      where: { id: cardId },
      data: { isDefault: true },
    });
  }

  async deleteCard(cardId: string, userId: string): Promise<void> {
    const card = await this.findById(cardId, userId);
    if (!card) {
      throw new NotFoundException('Payment card not found');
    }

    await this.prisma.paymentCard.update({
      where: { id: cardId },
      data: { deletedAt: new Date(), isActive: false },
    });

    if (card.isDefault) {
      const remainingCards = await this.findByUserId(userId);
      if (remainingCards.length > 0) {
        await this.setDefaultCard(remainingCards[0].id, userId);
      }
    }

    this.logger.log(`Card deleted for user ${userId}: ${cardId}`);
  }

  private detectCardType(cardNumber: string): string {
    if (cardNumber.startsWith('4')) {
      return 'visa';
    }
    if (cardNumber.startsWith('5') || cardNumber.startsWith('2')) {
      return 'mastercard';
    }
    if (
      cardNumber.startsWith('2200') ||
      cardNumber.startsWith('2201') ||
      cardNumber.startsWith('2202') ||
      cardNumber.startsWith('2203') ||
      cardNumber.startsWith('2204')
    ) {
      return 'mir';
    }
    return 'unknown';
  }

  async validateAndAddCard(
    userId: string,
    cardNumber: string,
    expiryMonth: number,
    expiryYear: number,
    cvv: string,
    holderName?: string,
  ): Promise<PaymentCard> {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    if (
      expiryYear < currentYear ||
      (expiryYear === currentYear && expiryMonth < currentMonth)
    ) {
      throw new ConflictException('Card has expired');
    }

    if (cvv.length !== 3 || !/^\d+$/.test(cvv)) {
      throw new ConflictException('Invalid CVV');
    }

    const last4Digits = cardNumber.slice(-4);
    const cardType = this.detectCardType(cardNumber);

    return this.addCard(userId, {
      last4Digits,
      cardType,
      expiryMonth,
      expiryYear,
      holderName,
    });
  }
}
