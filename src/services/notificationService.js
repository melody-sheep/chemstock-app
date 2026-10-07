// src/services/notificationService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';

// Same optional-p_agent_id pattern as touch_presence/get_presence —
// p_agent_id NULL resolves to auth.uid() server-side (Manager), agents
// (always anon, no Supabase Auth session) pass their id explicitly.
class NotificationService extends BaseService {
  constructor() {
    super('NotificationService');
  }

  async getMyNotifications(agentId = null, limit = 50) {
    debugLog('info', 'NotificationService', 'Fetching notifications', { agentId, limit });

    try {
      const { data, error } = await supabase.rpc('get_my_notifications', {
        p_agent_id: agentId,
        p_limit: limit,
      });

      if (error) {
        console.error('[ERROR] [NotificationService] get_my_notifications RPC error:', error);
        throw new Error(error.message || 'Failed to load notifications');
      }

      return { success: true, data: data?.notifications || [], unreadCount: data?.unreadCount || 0 };
    } catch (error) {
      this.log('error', 'getMyNotifications failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load notifications', data: [], unreadCount: 0 };
    }
  }

  async markNotificationRead(notificationId, agentId = null) {
    debugLog('info', 'NotificationService', 'Marking notification read', { notificationId, agentId });

    try {
      this.validateRequired(['notificationId'], { notificationId });

      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_agent_id: agentId,
      });

      if (error) {
        console.error('[ERROR] [NotificationService] mark_notification_read RPC error:', error);
        throw new Error(error.message || 'Failed to update notification');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'markNotificationRead failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to update notification' };
    }
  }

  async markAllNotificationsRead(agentId = null) {
    debugLog('info', 'NotificationService', 'Marking all notifications read', { agentId });

    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', { p_agent_id: agentId });

      if (error) {
        console.error('[ERROR] [NotificationService] mark_all_notifications_read RPC error:', error);
        throw new Error(error.message || 'Failed to update notifications');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'markAllNotificationsRead failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to update notifications' };
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
