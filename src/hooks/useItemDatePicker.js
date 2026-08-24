// src/hooks/useItemDatePicker.js
import { useState } from 'react';

/**
 * Drives a single native date-picker instance shared across a list of items
 * (e.g. batch rows each with their own Mfg/Exp date). Centralizes the
 * open/change/value logic that AddNewBatchesScreen and ProductPickerList
 * both needed identically, so it isn't duplicated per screen.
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
  const value =
    targetItem && target && targetItem[target.field] ? new Date(targetItem[target.field]) : new Date();

  return { target, open, handleChange, value };
}

export default useItemDatePicker;
