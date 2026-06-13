import { WalletEntryType } from '@prisma/client';

export function walletLedgerTypeLabel(type: WalletEntryType): string {
  switch (type) {
    case WalletEntryType.TOP_UP_CASH:
      return 'Пополнение депозита (наличные)';
    case WalletEntryType.TOP_UP_CARD:
      return 'Пополнение депозита (карта)';
    case WalletEntryType.TOP_UP_MOBILE:
      return 'Пополнение депозита (приложение)';
    case WalletEntryType.VISIT_CHARGE:
      return 'Списание за визит';
    case WalletEntryType.LOYALTY_BONUS:
      return 'Бонус программы лояльности';
    case WalletEntryType.DEBT_REPAYMENT:
      return 'Погашение задолженности';
    case WalletEntryType.REFUND:
      return 'Возврат пополнения';
    case WalletEntryType.ADJUSTMENT:
      return 'Корректировка депозита';
    default:
      return String(type);
  }
}
