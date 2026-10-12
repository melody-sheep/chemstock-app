// src/screens/common/NotificationsScreen.js
// Shared across all three roles, same precedent as ComingSoonScreen/
// EditProfileScreen — one screen, reached from each dashboard's bell icon.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/common/Header';
import Icon from '../../components/common/Icon';
import FilterSheet from '../../components/common/FilterSheet';
import useCachedFocusLoader from '../../hooks/useCachedFocusLoader';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';
import deliveryService from '../../services/deliveryService';
import inventoryService from '../../services/inventoryService';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';
import { formatRelativeTime } from '../../utils/formatters';
import { RADIUS } from '../../styles/radius';

const TYPE_META = {
  stock_request_submitted: { icon: 'notePencil', color: COLORS.accentGold },
  stock_request_resolved: { icon: 'sealCheck', color: COLORS.success },
  daily_report_submitted: { icon: 'clipboardText', color: COLORS.secondary },
  return_request_submitted: { icon: 'returnBox', color: COLORS.accentOrange },
  return_request_resolved: { icon: 'arrowUUpLeft', color: COLORS.accentPurple },
  delivery_assigned: { icon: 'truck', color: COLORS.primary },
  delivery_status_update: { icon: 'navigation', color: COLORS.iconTrackStroke },
  delivery_handoff_pending_sr: { icon: 'clockCountdown', color: '#B45309' },
  delivery_handoff_confirmed: { icon: 'sealCheck', color: COLORS.success },
  delivery_handoff_disputed: { icon: 'sealWarning', color: COLORS.error },
};
const DEFAULT_META = { icon: 'notification', color: COLORS.primary };

const FILTER_OPTIONS = [
  { key: 'all', label: 'All', icon: 'grid', description: 'Show every notification', types: null },
  {
    key: 'deliveries',
    label: 'Deliveries',
    icon: 'truck',
    description: 'Handoffs and status updates',
    types: ['delivery_assigned', 'delivery_status_update', 'delivery_handoff_pending_sr', 'delivery_handoff_confirmed', 'delivery_handoff_disputed'],
  },
  {
    key: 'stockRequests',
    label: 'Stock Requests',
    icon: 'notePencil',
    description: 'Request submissions and outcomes',
    types: ['stock_request_submitted', 'stock_request_resolved'],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'clipboardText',
    description: 'Daily report submissions',
    types: ['daily_report_submitted'],
  },
  {
    key: 'returns',
    label: 'Returns',
    icon: 'returnBox',
    description: 'Return requests and resolutions',
    types: ['return_request_submitted', 'return_request_resolved'],
  },
];

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
  const [activeFilter, setActiveFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [dateRange, setDateRange] = useState(null); // { from: Date, to: Date } | null

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
  const handlePressNotification = async (notification) => {
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      notificationService.markNotificationRead(notification.id, user?.id);
    }

    const targetTransactionId = notification.navParams?.transactionId;

    if (
      notification.type === 'delivery_handoff_pending_sr' &&
      targetTransactionId
    ) {
      if (!user?.id) {
        Alert.alert('Unable to Load Handoff', 'Your account could not be loaded. Please try again.');
        return;
      }
      try {
        const result = await deliveryService.getMyPendingHandoffs(user.id);
        if (!result.success) {
          Alert.alert('Unable to Load Handoff', result.message || 'Please try again.');
          return;
        }

        const handoff = result.data.find(
          (pendingHandoff) => pendingHandoff.transactionId === targetTransactionId
        );
        if (handoff) {
          navigation.navigate('SalesRepConfirmHandoff', { handoff });
        } else {
          Alert.alert(
            'Handoff Already Handled',
            'This delivery is no longer waiting for your confirmation.'
          );
        }
      } catch (error) {
        Alert.alert(
          'Unable to Load Handoff',
          error.message || 'Please try again.'
        );
      }
      return;
    }

    if (
      notification.type === 'delivery_handoff_confirmed' &&
      targetTransactionId
    ) {
      if (!user?.id) {
        Alert.alert('Unable to Load Delivery', 'Your account could not be loaded. Please try again.');
        return;
      }
      try {
        const result = await deliveryService.getMyCollectorDeliveries(user.id);
        if (!result.success) {
          Alert.alert('Unable to Load Delivery', result.message || 'Please try again.');
          return;
        }
        const match = result.data.find(
          (delivery) => delivery.transactionId === targetTransactionId
        );
        if (match) {
          navigation.navigate('CollectorDeliveredStock', {
            focusId: targetTransactionId,
          });
        } else {
          Alert.alert('Delivery Not Found', 'This delivery is no longer in your history.');
        }
      } catch (error) {
        Alert.alert('Unable to Load Delivery', error.message || 'Please try again.');
      }
      return;
    }

    if (
      notification.type === 'delivery_handoff_disputed' &&
      targetTransactionId
    ) {
      navigation.navigate('TrackDeliveries', { focusId: targetTransactionId });
      return;
    }

    if (
      notification.type === 'delivery_status_update' &&
      targetTransactionId
    ) {
      if (!user?.id) {
        Alert.alert('Unable to Load Delivery', 'Your account could not be loaded. Please try again.');
        return;
      }
      try {
        const result = await inventoryService.getMyDeliveries(user.id, 50);
        if (!result.success) {
          Alert.alert('Unable to Load Delivery', result.message || 'Please try again.');
          return;
        }
        const match = result.data.find(
          (delivery) => delivery.transactionId === targetTransactionId
        );
        if (match) {
          navigation.navigate('SalesRepDeliveryDetail', { delivery: match });
        } else {
          Alert.alert('Delivery Not Found', 'This delivery is no longer available.');
        }
      } catch (error) {
        Alert.alert('Unable to Load Delivery', error.message || 'Please try again.');
      }
      return;
    }

    if (notification.navTarget) {
      navigation.navigate(notification.navTarget, notification.navParams || undefined);
    }
  };

  const activeFilterOption = FILTER_OPTIONS.find((option) => option.key === activeFilter) || FILTER_OPTIONS[0];

  // The "To" date is a calendar-day pick (midnight) — compare against the
  // end of that day so a notification created any time on the "To" day is
  // still included, not just ones before 00:00.
  const matchesDateRange = (notification) => {
    if (!dateRange?.from || !dateRange?.to) return true;
    const created = new Date(notification.createdAt);
    const endOfTo = new Date(dateRange.to);
    endOfTo.setHours(23, 59, 59, 999);
    return created >= dateRange.from && created <= endOfTo;
  };

  const visibleNotifications = (
    activeFilterOption.types
      ? notifications.filter((n) => activeFilterOption.types.includes(n.type))
      : notifications
  ).filter(matchesDateRange);
  const hasUnread = notifications.some((n) => !n.isRead);
  const filterRowLabel = dateRange ? 'Custom range' : activeFilterOption.label;
  const isFilterActive = activeFilter !== 'all' || !!dateRange;

  return (
    <>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Header
          showBackButton
          title="Notifications"
          titleAlign="left"
          height={56}
          backgroundColor="#03045E"
          textColor="#FFFFFF"
        />

        <View style={styles.filterRow}>
          <Text style={styles.filterRowLabel}>{filterRowLabel}</Text>
          <TouchableOpacity
            style={styles.filterButtonWrap}
            onPress={() => setIsFilterSheetVisible(true)}
            activeOpacity={0.7}
            accessibilityLabel="Filter notifications"
            accessibilityRole="button"
          >
            <Icon name="filter" size={20} color={COLORS.primary} />
            {isFilterActive && <View style={styles.filterActiveDot} />}
          </TouchableOpacity>
        </View>

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
        ) : visibleNotifications.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Icon name="notification" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {!isFilterActive ? 'No notifications yet.' : 'No notifications in this filter.'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {visibleNotifications.map((notification) => {
              const meta = TYPE_META[notification.type] || DEFAULT_META;
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={styles.card}
                  onPress={() => handlePressNotification(notification)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.unreadStripe, !notification.isRead && styles.unreadStripeActive]} />
                  <View style={[styles.iconBadge, { backgroundColor: meta.color + '15' }]}>
                    <Icon name={meta.icon} size={18} color={meta.color} weight="duotone" />
                  </View>
                  <View style={styles.textCol}>
                    <View style={styles.titleRow}>
                      <Text style={styles.title} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      <Text style={styles.time}>{formatRelativeTime(notification.createdAt)}</Text>
                    </View>
                    <Text style={styles.body} numberOfLines={2}>
                      {notification.body}
                    </Text>
                  </View>
                  {!notification.isRead && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <FilterSheet
        visible={isFilterSheetVisible}
        onClose={() => setIsFilterSheetVisible(false)}
        title="Filter Notifications"
        options={FILTER_OPTIONS.map(({ key, label, icon, description }) => ({ key, label, icon, description }))}
        selectedKey={activeFilter}
        onSelect={setActiveFilter}
        clearKey="all"
        clearLabel="Show all"
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF1',
    backgroundColor: '#FFFFFF',
  },
  filterRowLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textSecondary,
  },
  filterButtonWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    overflow: 'hidden',
    paddingRight: SPACING.sm,
  },
  unreadStripe: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  unreadStripeActive: {
    backgroundColor: COLORS.primary,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  textCol: { flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  title: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.textPrimary,
  },
  body: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
  time: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    marginLeft: SPACING.xs,
  },
});
