// src/hooks/useConnectionStatus.js
import { useSyncExternalStore } from 'react';
import { getConnectionStatus, subscribeConnectionStatus } from '../services/connectionStatus';

/** @returns {{ online: boolean, lastOnlineAt: number }} */
export default function useConnectionStatus() {
  return useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus);
}
