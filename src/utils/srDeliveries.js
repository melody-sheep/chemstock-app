// src/utils/srDeliveries.js
// A Sales Rep's incoming collector deliveries: the loader Track Deliveries
// saves on the phone, plus helpers so a QR scan, a notification or Receive
// Stock can still find a delivery offline from that saved copy.
import authService from '../services/authService';
import inventoryService from '../services/inventoryService';
import deliveryService from '../services/deliveryService';
import { readSavedData } from '../hooks/useCachedFocusLoader';

export const SR_DELIVERIES_CACHE_KEY = 'sales-rep-track-deliveries';

// A failed fetch keeps the previous list instead of blanking it.
export const loadDeliveriesData = async (previous) => {
  const agent = await authService.getCurrentUser();
  const prev = previous?.agentId === agent?.id ? previous : null;
  const [result, handoffsResult] = await Promise.all([
    inventoryService.getMyDeliveries(agent?.id),
    deliveryService.getMyPendingHandoffs(agent?.id),
  ]);
  // Either request failing (offline) keeps the last complete list; a missing
  // handoff list would otherwise drop "Awaiting your confirmation".
  if ((!result.success || !handoffsResult.success) && prev) {
    return prev;
  }
  const baseDeliveries = result.success ? result.data : [];
  const handoffs = handoffsResult.success ? handoffsResult.data : [];
  const handoffsByTransaction = new Map(handoffs.map((handoff) => [handoff.transactionId, handoff]));
  const deliveriesByTransaction = new Map();

  baseDeliveries.forEach((delivery) => {
    const handoff = handoffsByTransaction.get(delivery.transactionId);
    deliveriesByTransaction.set(delivery.transactionId, {
      ...delivery,
      handoffStatus: handoff?.handoffStatus ?? delivery.handoffStatus,
      handoff: handoff ?? delivery.handoff,
    });
  });

  handoffs.forEach((handoff) => {
    if (!deliveriesByTransaction.has(handoff.transactionId)) {
      deliveriesByTransaction.set(handoff.transactionId, {
        transactionId: handoff.transactionId,
        createdAt: handoff.collectorClaimedAt,
        deliveredAt: handoff.deliveredAt,
        deliveryStatus: handoff.deliveryStatus || 'delivered',
        collectorName: handoff.collectorName,
        qrCode: handoff.releaseQrCode,
        items: handoff.items || [],
        handoffStatus: handoff.handoffStatus,
        handoff,
      });
    }
  });

  return {
    agentId: agent?.id,
    deliveries: [...deliveriesByTransaction.values()].sort(
      (a, b) => new Date(b.deliveredAt || b.createdAt).getTime() - new Date(a.deliveredAt || a.createdAt).getTime()
    ),
  };
};

/**
 * Whether the Sales Rep can receive this delivery now:
 * - delivered and waiting for them (the usual case), or
 * - still "on the way" on the server, because the Collector may have marked
 *   it delivered offline. The receipt is saved and the server only accepts
 *   it once the Collector's side has synced, with the matching QR.
 */
export function isReceivable(delivery) {
  if (!delivery) return false;
  if (delivery.handoffStatus === 'confirmed' || delivery.handoffStatus === 'disputed') return false;
  if (delivery.deliveryStatus === 'delivered') return delivery.handoffStatus === 'pending_sr';
  return delivery.deliveryStatus === 'in_transit';
}

/** Navigation params for SalesRepConfirmHandoff, built from a saved delivery. */
export function confirmHandoffParams(delivery, extra = {}) {
  const collectorPending = delivery.deliveryStatus !== 'delivered';
  return {
    handoff: {
      transactionId: delivery.transactionId,
      collectorName: delivery.handoff?.collectorName || delivery.collectorName,
      collectorClaimedAt: collectorPending
        ? null
        : delivery.handoff?.collectorClaimedAt || delivery.deliveredAt || delivery.createdAt,
      collectorGps: delivery.handoff?.collectorGps || delivery.destinationGps || null,
      releaseQrCode: delivery.handoff?.releaseQrCode || delivery.qrCode || null,
      items: delivery.handoff?.items || delivery.items || [],
      handoffStatus: collectorPending ? 'awaiting_collector' : delivery.handoffStatus,
      collectorPending,
    },
    // Lets the confirm screen offer "View on map".
    delivery: delivery.destinationGps ? delivery : null,
    ...extra,
  };
}

/** The saved delivery matching a transaction id or release QR, or null. */
export async function findSavedDelivery({ transactionId, qrCode } = {}, agentId) {
  const saved = await readSavedData(SR_DELIVERIES_CACHE_KEY);
  if (!saved || (agentId && saved.agentId !== agentId)) return null;
  return (
    (saved.deliveries || []).find(
      (d) =>
        (transactionId && d.transactionId === transactionId) ||
        (qrCode && (d.qrCode === qrCode || d.handoff?.releaseQrCode === qrCode))
    ) || null
  );
}

/** Saved deliveries the Sales Rep can receive now (for offline counts). */
export async function savedReceivableDeliveries(agentId) {
  const saved = await readSavedData(SR_DELIVERIES_CACHE_KEY);
  if (!saved || (agentId && saved.agentId !== agentId)) return [];
  return (saved.deliveries || []).filter(isReceivable);
}
