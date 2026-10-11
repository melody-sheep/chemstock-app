export function getLogItems(log) {
  if (log.logType === 'release' || log.logType === 'delivery') {
    return (log.transaction_details || []).map((item) => ({
      key: item.batch_number,
      name: item.product_name,
      qty: item.quantity,
      mfgDate: item.mfg_date,
      expDate: item.exp_date,
    }));
  }
  return (log.branch_inventory || []).map((item) => ({
    key: item.batch_number,
    name: item.product_name,
    qty: item.received_quantity,
    mfgDate: item.mfg_date,
    expDate: item.exp_date,
  }));
}

export function getLogGps(log) {
  if (log.logType === 'delivery') return log.destination_gps;
  return log.logType === 'release' ? log.origin_gps : log.gps_coordinates;
}
