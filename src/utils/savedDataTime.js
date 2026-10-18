// src/utils/savedDataTime.js
import { useSyncExternalStore } from 'react';

// When the data on the screen in front of the user was last loaded from the
// server. Set by useCachedFocusLoader while its screen is focused, read by the
// Offline pill ("Offline · as of 7:25 PM"). null when the screen keeps no
// saved data.
let focusedSavedAt = null;
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());

export function setFocusedSavedAt(savedAt) {
  if (focusedSavedAt === savedAt) return;
  focusedSavedAt = savedAt;
  emit();
}

/** Clears the time, but only if it is still the one this screen set. */
export function clearFocusedSavedAt(savedAt) {
  if (focusedSavedAt !== savedAt) return;
  focusedSavedAt = null;
  emit();
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export default function useSavedDataTime() {
  return useSyncExternalStore(subscribe, () => focusedSavedAt);
}
