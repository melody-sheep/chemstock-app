// src/hooks/useUnseenLogCount.js
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import authService from '../services/authService';
import storage from '../utils/storage';

const SEEN_KEY_PREFIX = 'chemstock_logs_seen_';

async function markLogsSeen(userId) {
  if (userId) await storage.set(SEEN_KEY_PREFIX + userId, Date.now());
}

/**
 * How many log entries are newer than the last time this account opened its
 * logs screen — the number on the header's logs icon. Kept per account on
 * this device; the first run starts at zero rather than counting all history.
 *
 * @param {string|null} userId
 * @param {string[]} logTimes - timestamps of the log entries the screen has.
 * @returns {number}
 */
export default function useUnseenLogCount(userId, logTimes) {
  const [seenAt, setSeenAt] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return undefined;
      let active = true;
      (async () => {
        let stored = await storage.get(SEEN_KEY_PREFIX + userId);
        if (!stored) {
          stored = Date.now();
          await markLogsSeen(userId);
        }
        if (active) setSeenAt(stored);
      })();
      return () => {
        active = false;
      };
    }, [userId])
  );

  if (!seenAt) return 0;
  return (logTimes || []).filter((time) => time && new Date(time).getTime() > seenAt).length;
}

/** Call from a logs screen: opening it clears the badge. */
export function useMarkLogsSeen() {
  useFocusEffect(
    useCallback(() => {
      authService.getCurrentUser().then((user) => markLogsSeen(user?.id));
    }, [])
  );
}
