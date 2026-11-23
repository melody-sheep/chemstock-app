// src/utils/stockGroups.js
// Groups a stock section's batches by product, so a product with many batches
// shows as one card. Keeps the order the rows arrive in (the order of each
// product's first batch).

export function groupBatchesByProduct(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.product_code)) {
      groups.set(row.product_code, {
        key: row.product_code,
        product_code: row.product_code,
        product_name: row.product_name,
        batches: [],
      });
    }
    groups.get(row.product_code).batches.push(row);
  });

  return [...groups.values()].map((group) => {
    // A product's batches always list soonest expiry first (none last), whatever the section's sort.
    const batches = [...group.batches].sort((a, b) => {
      if (!a.exp_date && !b.exp_date) return 0;
      if (!a.exp_date) return 1;
      if (!b.exp_date) return -1;
      return String(a.exp_date).localeCompare(String(b.exp_date));
    });
    return {
      ...group,
      batches,
      totalQuantity: batches.reduce((sum, batch) => sum + (batch.quantity || 0), 0),
      soonestExpDate: batches.find((batch) => batch.exp_date)?.exp_date || null,
    };
  });
}

// What StockBatchDetail needs for one batch. The Sales Rep view also hides the
// QR and passes the product and branch ids.
export function buildBatchDetailParams(row, { variant, branchName, branchId }) {
  const params = {
    productName: row.product_name,
    quantity: row.quantity,
    batchNumber: row.batch_number,
    expDate: row.exp_date,
    mfgDate: row.mfg_date,
    branchName,
  };
  if (variant === 'salesrep') {
    Object.assign(params, { hideQr: true, productCode: row.product_code, branchId });
  }
  return params;
}
