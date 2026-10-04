// src/utils/batchItemValidation.js

// Items lacking an MFG or EXP date. Dates are ISO yyyy-mm-dd strings, so the
// date-order check can compare them as plain strings.
export const getItemsMissingDates = (items) =>
  items.filter((item) => !item.mfgDate || !item.expDate);

export const getItemsWithDateOrderError = (items) =>
  items.filter((item) => item.mfgDate && item.expDate && item.expDate < item.mfgDate);

export const listItemNames = (items) => items.map((item) => item.name).join(', ');
