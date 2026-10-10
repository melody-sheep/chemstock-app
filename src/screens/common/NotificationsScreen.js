// src/screens/common/NotificationsScreen.js
// Shared across all three roles, same precedent as ComingSoonScreen/
// EditProfileScreen — one screen, reached from each dashboard's bell icon.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';

const TYPE_META = {
  stock_request_submitted: { icon: 'notePencil', color: COLORS.accentGold },
  stock_request_resolved: { icon: 'checkCircle', color: COLORS.success },
  daily_report_submitted: { icon: 'document', color: COLORS.secondary },
  return_request_submitted: { icon: 'returnBox', color: COLORS.accentOrange },
  return_request_resolved: { icon: 'checkCircle', color: COLORS.success },
  delivery_assigned: { icon: 'truck', color: COLORS.primary },
  delivery_status_update: { icon: 'truck', color: COLORS.primary },
};
const DEFAULT_META = { icon: 'notification', color: COLORS.primary };

// A failed fetch keeps the previous snapshot instead of blanking the screen
// — without this, "no notifications" and "failed to load while offline"
// looked identical (both showed the empty state).
const loadNotificationsData = async (previous) => {
  const currentUser = await authService.getCurrentUser();
  const prev = previous?.user?.id === currentUser?.id ? previous : null;
  const result = await notificationService.getMyNotifications(currentUser?.id);
  return {
    user: currentUser,
    notifications: result.success ? result.data : prev?.notifications ?? [],
  };
};

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { data: snapshot, isLoading } = useCachedFocusLoader('notifications', loadNotificationsData);
  const user = snapshot?.user ?? null;

  // Local copy so mark-as-read can update optimistically — reseeded from the
  // cached snapshot whenever it changes (a fresh load, or a background
  // refresh completing), same as the screen always did on every focus.
  const [notifications, setNotifications] = useState([]);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  useEffect(() => {
    setNotifications(snapshot?.notifications ?? []);
  }, [snapshot]);

  const handleMarkAllRead = async () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);
    const result = await notificationService.markAllNotificationsRead(user?.id);
    setIsMarkingAll(false);
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  // Marks as read optimistically (and fires the RPC in the background) so
  // tapping a notification navigates immediately instead of waiting on a
  // round trip — the badge/list will reconcile with the server on next focus
  // regardless.
  const handlePressNotification = (notification) => {
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      notificationService.markNotificationRead(notification.id, user?.id);
    }
    if (notification.navTarget) {
      navigation.navigate(notification.navTarget, notification.navParams || undefined);
    }
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          backButtonText="Back"
          title="Notifications"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

        {hasUnread && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={handleMarkAllRead}
              disabled={isMarkingAll}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Text style={styles.markAllText}>{isMarkingAll ? 'Marking…' : 'Mark all as read'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="notification" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {notifications.map((notification) => {
              const meta = TYPE_META[notification.type] || DEFAULT_META;
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[styles.card, !notification.isRead && styles.cardUnread]}
                  onPress={() => handlePressNotification(notification)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBadge, { backgroundColor: meta.color + '15' }]}>
                    <Icon name={meta.icon} size={18} color={meta.color} weight="duotone" />
                  </View>
                  <View style={styles.textCol}>
                    <Text style={styles.title} numberOfLines={1}>
                      {notification.title}
                    </Text>
                    <Text style={styles.body} numberOfLines={2}>
                      {notification.body}
                    </Text>
                    <Text style={styles.time}>{formatRelativeTime(notification.createdAt)}</Text>
                  </View>
                  {!notification.isRead && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  markAllText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.primary,
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    padding: SPACING.sm,
  },
  cardUnread: {
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '08',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  body: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  time: {
    marginTop: 4,
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    marginTop: 4,
  },
});
