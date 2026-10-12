// src/hooks/useUnreadNotificationCount.js
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import notificationService from '../services/notificationService';

const POLL_INTERVAL_MS = 20 * 1000;

/**
 * Live unread count for the header bell. Fetched when the screen gains focus
 * and every 20s while it stays focused, so a new notification shows on the
 * badge without leaving and reopening the dashboard.
 *
 * @param {string|null} agentId - null for a Manager (resolved server-side).
 * @param {boolean} isReady - false until the caller knows who is signed in.
 * @returns {number|null} null until the first successful fetch.
 */
export default function useUnreadNotificationCount(agentId, isReady = true) {
  const [count, setCount] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (!isReady) return undefined;
      let active = true;
      const fetchCount = async () => {
        const result = await notificationService.getMyNotifications(agentId, 1);
        if (active && result.success) setCount(result.unreadCount);
      };
      fetchCount();
      const timer = setInterval(fetchCount, POLL_INTERVAL_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [agentId, isReady])
  );

  return count;
}
