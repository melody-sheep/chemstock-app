// src/services/connectionStatus.js
// Tracks whether the app can reach the server, from the requests it already
// makes. supabaseClient routes every request through markOnline/markOffline, so
// no extra polling is needed. The status only notifies listeners when it
// changes, so the lastOnlineAt timestamp updates without re-rendering screens.

let status = { online: true, lastOnlineAt: Date.now() };
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

export function markOnline() {
  const wasOffline = !status.online;
  status = { online: true, lastOnlineAt: Date.now() };
  if (wasOffline) notify();
}

export function markOffline() {
  if (!status.online) return;
  status = { ...status, online: false };
  notify();
}

export function getConnectionStatus() {
  return status;
}

export function subscribeConnectionStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
