import { PrismaClient } from '@prisma/client';

export async function clearDatabaseFull(prisma: PrismaClient): Promise<void> {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['user_notifications', () => prisma.userNotification.deleteMany()],
    ['pending_loyalty_bonuses', () => prisma.pendingLoyaltyBonus.deleteMany()],
    ['wallet_ledger_entries', () => prisma.walletLedgerEntry.deleteMany()],
    ['loyalty_tier_history', () => prisma.loyaltyTierHistory.deleteMany()],
    ['order_chat_attachments', () => prisma.orderChatAttachment.deleteMany()],
    ['order_chat_read_states', () => prisma.orderChatReadState.deleteMany()],
    [
      'order_chat_typing_states',
      () => prisma.orderChatTypingState.deleteMany(),
    ],
    ['order_chat_messages', () => prisma.orderChatMessage.deleteMany()],
    ['order_chats', () => prisma.orderChat.deleteMany()],
    ['task_completions', () => prisma.taskCompletion.deleteMany()],
    ['task_templates', () => prisma.taskTemplate.deleteMany()],
    ['activity_logs', () => prisma.activityLog.deleteMany()],
    ['transactions', () => prisma.transaction.deleteMany()],
    ['order_items', () => prisma.orderItem.deleteMany()],
    ['reviews', () => prisma.review.deleteMany()],
    ['orders', () => prisma.order.deleteMany()],
    [
      'cafe_shared_asset_reservations',
      () => prisma.cafeSharedAssetReservation.deleteMany(),
    ],
    ['appointments', () => prisma.appointment.deleteMany()],
    ['cafe_layout_elements', () => prisma.cafeLayoutElement.deleteMany()],
    ['cafe_room_assets', () => prisma.cafeRoomAsset.deleteMany()],
    ['cafe_rooms', () => prisma.cafeRoom.deleteMany()],
    ['cafe_layouts', () => prisma.cafeLayout.deleteMany()],
    ['cafe_shared_assets', () => prisma.cafeSharedAsset.deleteMany()],
    ['payment_cards', () => prisma.paymentCard.deleteMany()],
    ['cafe_menu_items', () => prisma.cafeMenuItem.deleteMany()],
    ['cafe_menu_categories', () => prisma.cafeMenuCategory.deleteMany()],
    [
      'worker_schedule_absences',
      () => prisma.workerScheduleAbsence.deleteMany(),
    ],
    ['network_guests', () => prisma.networkGuest.deleteMany()],
    ['worker_accounts', () => prisma.workerAccount.deleteMany()],
    ['users', () => prisma.user.deleteMany()],
    ['brand_api_keys', () => prisma.brandApiKey.deleteMany()],
    ['brand_documents', () => prisma.brandDocument.deleteMany()],
    ['cafes', () => prisma.cafe.deleteMany()],
    ['loyalty_tiers', () => prisma.loyaltyTier.deleteMany()],
    ['brands', () => prisma.brand.deleteMany()],
    ['regions', () => prisma.region.deleteMany()],
    ['system_settings', () => prisma.systemSettings.deleteMany()],
    [
      'platform_loyalty_settings',
      () => prisma.platformLoyaltySettings.deleteMany(),
    ],
  ];

  for (const [name, fn] of steps) {
    await fn();
    console.log(`  ✓ ${name}`);
  }
}
