// src/utils/queuedReceipts.js
// Stock received while offline sits in the outbox until it syncs. These
// helpers let screens treat it as already received on this phone: shown in
// the backpack, the delivery marked confirmed, and not receivable twice.
import outboxService from '../services/outboxService';

const RECEIPT_TYPES = ['receive_stock', 'confirm_delivery_handoff'];

/** Receipts still waiting to sync for this agent (items refused for good excluded). */
export function getQueuedReceipts(entries, agentId) {
  if (!agentId) return [];
  return entries.filter(
    (e) => RECEIPT_TYPES.includes(e.type) && !e.failed && e.payload?.agentId === agentId
  );
}

const identifiersOf = (entry) =>
  [
    entry.payload?.transactionId,
    entry.payload?.qrCode,
    entry.payload?.scannedQrCode,
    entry.display?.transactionId,
    entry.display?.qrCode,
  ].filter(Boolean);

/**
 * The queued receipt for a delivery, if any. Matches on transaction id or QR,
 * so it also catches receipts queued by the 1.0.2 app (no display copy).
 */
export function findQueuedReceipt({ transactionId, qrCode } = {}, agentId, entries = outboxService.getEntries()) {
  const wanted = [transactionId, qrCode].filter(Boolean);
  if (wanted.length === 0) return null;
  return getQueuedReceipts(entries, agentId).find((e) => identifiersOf(e).some((id) => wanted.includes(id))) || null;
}

/** Backpack rows (sr_inventory shape) for queued receipts that kept a display copy. */
export function queuedBackpackRows(entries, agentId) {
  return getQueuedReceipts(entries, agentId).flatMap((entry) =>
    (entry.display?.items || []).map((item, index) => ({
      id: `queued-${entry.id}-${index}`,
      product_code: item.productCode,
      product_name: item.productName,
      remaining_quantity: Number(item.quantity) || 0,
      batch_number: item.batchNumber || null,
      exp_date: item.expDate || null,
      isQueued: true,
    }))
  );
}

/** Units waiting to sync, for totals. */
export function queuedUnits(entries, agentId) {
  return queuedBackpackRows(entries, agentId).reduce((sum, row) => sum + row.remaining_quantity, 0);
}

/** What a screen saves next to a queued receipt (never sent to the server). */
export function receiptDisplay({ transactionId, qrCode, items }) {
  return {
    transactionId: transactionId || null,
    qrCode: qrCode || null,
    items: (items || []).map((item) => ({
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
      batchNumber: item.batchNumber || null,
      expDate: item.expDate || null,
    })),
  };
}
