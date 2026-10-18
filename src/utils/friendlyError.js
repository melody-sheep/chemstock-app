// src/utils/friendlyError.js
import { getConnectionStatus } from '../services/connectionStatus';

export const NO_INTERNET_MESSAGE = 'No internet connection. Connect and try again.';

// What a failed request looks like by the time it reaches a screen, e.g.
// "Error: java.net.UnknownHostException: Unable to resolve host …supabase.co"
// or "TypeError: Network request failed".
const NETWORK_PATTERNS = [
  /UnknownHost/i,
  /Unable to resolve host/i,
  /Network request failed/i,
  /Failed to fetch/i,
  /ConnectException/i,
  /Failed to connect/i,
  /SocketTimeout/i,
  /timed? ?out/i,
  /AbortError/i,
  /aborted/i,
  /java\.(net|io)\./i,
  /supabase\.co/i,
  /FetchError/i,
];

export function isNetworkError(message) {
  if (!message) return false;
  const text = String(message);
  return NETWORK_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * The message to show the user for a failed request: a plain "no internet"
 * line instead of a raw network error, otherwise the message unchanged.
 * With no message at all while offline it also says "no internet", so the
 * caller's own fallback (`friendlyError(x) || 'Please try again.'`) is only
 * used online.
 */
export function friendlyError(message) {
  if (isNetworkError(message)) return NO_INTERNET_MESSAGE;
  if (!message && !getConnectionStatus().online) return NO_INTERNET_MESSAGE;
  return message;
}

export default friendlyError;
