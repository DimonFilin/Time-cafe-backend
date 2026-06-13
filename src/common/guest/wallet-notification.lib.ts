import { WalletEntryType } from '@prisma/client';

export function walletPaymentTypeLabel(type: WalletEntryType): string {
  switch (type) {
    case WalletEntryType.TOP_UP_CASH:
      return 'наличные';
    case WalletEntryType.TOP_UP_CARD:
      return 'банковская карта';
    case WalletEntryType.TOP_UP_MOBILE:
      return 'мобильное приложение';
    default:
      return String(type);
  }
}

export function buildTopUpNotification(params: {
  amount: number;
  paymentType: WalletEntryType;
  source: 'MOBILE' | 'CAFE';
  cardLabel?: string | null;
}): { type: string; title: string; body: string } {
  const pay = walletPaymentTypeLabel(params.paymentType);
  const payDetail = params.cardLabel
    ? `${pay}, карта •••• ${params.cardLabel}`
    : pay;
  const sum = params.amount.toFixed(2);

  if (params.source === 'CAFE') {
    return {
      type: 'WALLET_TOP_UP_STAFF',
      title: 'Пополнение на ресепшене',
      body: `Сотрудник кафе пополнил депозит на ${sum} BYN (${payDetail}).`,
    };
  }

  return {
    type: 'WALLET_TOP_UP',
    title: 'Депозит пополнен',
    body: `Вы пополнили депозит на ${sum} BYN (${payDetail}).`,
  };
}
