// src/services/presenceService.js
// Presence: each signed-in user's app records when it was last active, and the
// delivery maps read that back to show who is online. Writes are throttled, so
// this adds at most one small request every couple of minutes per device.
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';
import { formatRelativeTime } from '../utils/formatters';
import { resolveProfilePhotoUrl } from '../utils/profilePhoto';
import { getInitials } from '../utils/initials';

const TOUCH_INTERVAL_MS = 2 * 60 * 1000;
// Someone counts as online if their app was active within this window.
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

let identityId = null;
let timer = null;

const touch = async () => {
  if (!identityId) return;
  const { error } = await supabase.rpc('touch_presence', { p_agent_id: identityId });
  if (error) debugLog('warn', 'Presence', 'Could not record presence', { message: error.message });
};

/** Called once the signed-in user is known. Starts the periodic write. */
export function setPresenceIdentity(userId) {
  if (timer) clearInterval(timer);
  identityId = userId || null;
  timer = null;
  if (identityId) {
    touch();
    timer = setInterval(touch, TOUCH_INTERVAL_MS);
  }
}

/**
 * Reads last_seen_at for the given user ids. Returns { [id]: isoString }.
 * Before the presence SQL has been run this returns {} and the map shows
 * "status unknown", so nothing breaks.
 */
export async function getPresence(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc('get_presence', { p_ids: ids });
  if (error) {
    debugLog('warn', 'Presence', 'Could not read presence', { message: error.message });
    return {};
  }
  return Object.fromEntries((data || []).map((row) => [row.id, row.last_seen_at]));
}

/**
 * Turns a last-seen time into what the map shows: online, or the last time
 * they were online. An unknown time gives online: null.
 */
export function describePresence(lastSeenAt, now = Date.now()) {
  if (!lastSeenAt) return { online: null, statusLabel: 'Status unknown' };
  const seenAt = new Date(lastSeenAt).getTime();
  if (Number.isNaN(seenAt)) return { online: null, statusLabel: 'Status unknown' };
  if (now - seenAt <= ONLINE_WINDOW_MS) return { online: true, statusLabel: 'Online' };
  return { online: false, statusLabel: `Last online ${formatRelativeTime(lastSeenAt)}` };
}

/**
 * Loads the collector and the Sales Rep for one delivery, with photo URLs and
 * presence, shaped as map avatars: { photoUrl, initials, online, statusLabel }.
 * Returns null on any failure, so the map falls back to plain markers.
 */
export async function getDeliveryParties(agentId, transactionId) {
  if (!agentId || !transactionId) return null;
  const { data, error } = await supabase.rpc('get_delivery_parties', {
    p_agent_id: agentId,
    p_transaction_id: transactionId,
  });
  if (error || !data) {
    debugLog('warn', 'Presence', 'Could not load delivery parties', { message: error?.message });
    return null;
  }
  const toAvatar = async (person) => {
    if (!person) return null;
    return {
      id: person.id,
      fullName: person.fullName,
      photoUrl: await resolveProfilePhotoUrl(person.photoPath),
      initials: getInitials(person.fullName),
      ...describePresence(person.lastSeenAt),
    };
  };
  const [collector, salesRep] = await Promise.all([toAvatar(data.collector), toAvatar(data.salesRep)]);
  return { collector, salesRep };
}
