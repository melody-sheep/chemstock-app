// src/hooks/useItemDatePicker.js
import { useState } from 'react';

/**
 * Drives a single native date-picker instance shared across a list of items
 * (e.g. batch rows each with their own Mfg/Exp date). Centralizes the
 * open/change/value logic that AddNewBatchesScreen and ProductPickerList
 * both needed identically, so it isn't duplicated per screen.
 *
 * Also enforces Exp >= Mfg by constraining the *calendar itself*
 * (minimumDate/maximumDate) rather than validating after the fact — the
 * invalid range is simply never selectable, whichever date the manager sets
 * first.
 *
 * @param {Array<{code: string} & Record<string, any>>} items
 * @param {(code: string, field: string, value: string) => void} onDateChange
 */
export function useItemDatePicker(items, onDateChange) {
  const [target, setTarget] = useState(null); // { code, field } | null

  const open = (code, field) => {
    setTarget({ code, field });
  };

  const handleChange = (event, selectedDate) => {
    const current = target;
    setTarget(null);
    if (event.type === 'set' && selectedDate && current) {
      onDateChange(current.code, current.field, selectedDate.toISOString().slice(0, 10));
    }
  };

  const targetItem = items.find((item) => item.code === target?.code);
  const field = target?.field;

  const minimumDate = field === 'expDate' && targetItem?.mfgDate ? new Date(targetItem.mfgDate) : undefined;
  const maximumDate = field === 'mfgDate' && targetItem?.expDate ? new Date(targetItem.expDate) : undefined;

  let value = targetItem && field && targetItem[field] ? new Date(targetItem[field]) : new Date();
  if (minimumDate && value < minimumDate) value = minimumDate;
  if (maximumDate && value > maximumDate) value = maximumDate;

  return { target, open, handleChange, value, minimumDate, maximumDate };
}

export default useItemDatePicker;
