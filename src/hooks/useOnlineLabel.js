// src/hooks/useOnlineLabel.js
import useConnectionStatus from './useConnectionStatus';
import useSavedDataTime from '../utils/savedDataTime';
import { formatAsOf } from '../utils/formatters';

/**
 * "Online", or "Offline · as of 7:25 PM": when the data on this screen was
 * last loaded from the server, else the last time the app reached it.
 */
export default function useOnlineLabel() {
  const connection = useConnectionStatus();
  const savedAt = useSavedDataTime();
  return connection.online ? 'Online' : `Offline · as of ${formatAsOf(savedAt ?? connection.lastOnlineAt)}`;
}
