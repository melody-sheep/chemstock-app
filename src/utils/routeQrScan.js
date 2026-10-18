// src/utils/routeQrScan.js
import { Alert } from 'react-native';
import inventoryService from '../services/inventoryService';
import { findQueuedReceipt } from './queuedReceipts';

/**
 * Routes a Sales Rep's scanned QR according to the transaction's server state.
 *
 * @param {{ qrCode: string, agentId: string, navigation: Object }} options
 * @returns {Promise<{kind: string}>}
 */
export async function routeQrScan({ qrCode, agentId, navigation }) {
  if (!agentId) {
    Alert.alert('Unable to Verify QR', 'Your account could not be loaded. Please try again.');
    return { kind: 'no_agent' };
  }

  const alreadyQueued = () => {
    Alert.alert('Already Received', 'You already received this delivery on this phone. It will sync automatically once you are online.');
    return { kind: 'already_queued' };
  };

  // Checked on the phone first, so it works offline too.
  if (findQueuedReceipt({ qrCode }, agentId)) return alreadyQueued();

  const result = await inventoryService.getTransactionByQrCodeForAgent(qrCode, agentId);

  if (!result.success || !result.data) {
    Alert.alert('Delivery Not Found', "This QR doesn't match any delivery assigned to you.");
    return { kind: 'unknown' };
  }

  const tx = result.data;

  if (findQueuedReceipt({ transactionId: tx.transactionId, qrCode: tx.qrCode }, agentId)) return alreadyQueued();

  if (tx.handoffStatus === 'confirmed') {
    Alert.alert('Already Confirmed', 'You already confirmed this delivery.');
    return { kind: 'already_confirmed' };
  }

  if (tx.handoffStatus === 'disputed') {
    Alert.alert('Already Reported', 'You already reported an issue with this delivery.');
    return { kind: 'already_disputed' };
  }

  if (tx.movementType === 'direct' && tx.alreadyAccepted) {
    Alert.alert('Already Accepted', 'This batch was already accepted.');
    return { kind: 'already_accepted' };
  }

  if (tx.isHandoffPending) {
    navigation.navigate('SalesRepConfirmHandoff', {
      handoff: {
        handoffId: tx.handoffId,
        transactionId: tx.transactionId,
        handoffStatus: tx.handoffStatus,
        collectorClaimedAt: tx.collectorClaimedAt,
        collectorId: tx.collectorId,
        collectorName: tx.collectorName,
        collectorGps: tx.collectorGps,
        releaseQrCode: tx.qrCode,
        items: tx.items || [],
        branchId: tx.branchId,
        branchName: tx.branchName,
        deliveryStatus: tx.deliveryStatus || 'delivered',
        deliveredAt: tx.deliveredAt || tx.collectorClaimedAt,
      },
      initialScannedQr: qrCode,
    });
    return { kind: 'handoff_pending' };
  }

  if (tx.movementType === 'collector') {
    Alert.alert(
      'Handoff Not Pending',
      'This collector delivery is not waiting for your confirmation.'
    );
    return { kind: 'handoff_not_pending' };
  }

  if (tx.movementType !== 'direct') {
    Alert.alert('Delivery Not Found', "This QR doesn't match a delivery assigned to you.");
    return { kind: 'unknown' };
  }

  navigation.navigate('SalesRepConfirmHandoff', {
    directTransaction: {
      transactionId: tx.transactionId,
      qrCode: tx.qrCode,
      movementType: tx.movementType,
      releasedByName: tx.releasedByName,
      releasedByPhotoPath: tx.releasedByPhotoPath,
      targetRecipientId: tx.targetRecipientId,
      targetRecipientName: tx.targetRecipientName,
      branchName: tx.branchName,
      items: tx.items || [],
    },
    initialScannedQr: qrCode,
  });
  return { kind: 'direct_pending' };
}

export default routeQrScan;
