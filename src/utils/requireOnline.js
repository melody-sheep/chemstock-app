// src/utils/requireOnline.js
import Alert from './appAlert';
import { getConnectionStatus } from '../services/connectionStatus';

/**
 * For actions that can't be saved for later (manager actions): when offline,
 * shows a clear "needs internet" message and returns false.
 * @param {string} action - what the user tried, e.g. 'Accepting a report'
 */
export default function requireOnline(action) {
  if (getConnectionStatus().online) return true;
  Alert.alert('Needs Internet', `${action} needs an internet connection. Please reconnect and try again.`);
  return false;
}
