// src/utils/scanLookup.js
import inventoryService from '../services/inventoryService';

// Summarizes a receiving-batch QR for the manager's branches, ready for an Alert.
export const describeReceivingScan = async (qrCode, branchIds) => {
  const result = await inventoryService.getReceivingBatchByQrCode(qrCode, branchIds);

  if (!result.success) {
    return { status: 'error', title: 'Scan Failed', message: result.message || 'Please try again.' };
  }
  if (!result.data) {
    return { status: 'nomatch', title: 'No Match', message: 'No stock batch in your branch matches this QR code.' };
  }

  const rows = result.data.branch_inventory || [];
  const units = rows.reduce((sum, row) => sum + (row.quantity || 0), 0);
  const lines = rows.map((row) => `• ${row.product_name} (${row.batch_number}): ${row.quantity}`);

  return {
    status: 'found',
    batch: {
      receivedAt: result.data.created_at || null,
      totalUnits: units,
      items: rows.map((row) => ({
        productCode: row.product_code,
        productName: row.product_name,
        batchNumber: row.batch_number,
        quantity: row.quantity || 0,
        expDate: row.exp_date || null,
        mfgDate: row.mfg_date || null,
      })),
    },
    title: 'Batch Found',
    message: [`${rows.length} item${rows.length === 1 ? '' : 's'}, ${units} units remaining`, ...lines].join('\n'),
  };
};
