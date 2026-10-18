// src/screens/common/NotificationsScreen.js
// Shared across all three roles, same precedent as ComingSoonScreen/
// EditProfileScreen — one screen, reached from each dashboard's bell icon.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import friendlyError, { isNetworkError } from '../../utils/friendlyError';
import { findSavedDelivery, isReceivable, confirmHandoffParams } from '../../utils/srDeliveries';
import { findQueuedReceipt } from '../../utils/queuedReceipts';
import { getConnectionStatus } from '../../services/connectionStatus';

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
  stock_released_to_you: { icon: 'package', color: COLORS.accentPurple },
  stock_request_fulfilled: { icon: 'sealCheck', color: COLORS.success },
  stock_accepted: { icon: 'trayDown', color: COLORS.secondary },
  delivery_completed: { icon: 'checkCircle', color: COLORS.success },
  delivery_received: { icon: 'sealCheck', color: COLORS.success },
  delivery_disputed_collector: { icon: 'sealWarning', color: COLORS.error },
  daily_report_accepted: { icon: 'clipboardText', color: COLORS.success },
  discrepancy_found: { icon: 'warning', color: COLORS.error },
  collector_return_initiated: { icon: 'arrowUUpLeft', color: COLORS.accentOrange },
  collector_return_received: { icon: 'sealCheck', color: COLORS.success },
};
const DEFAULT_META = { icon: 'notification', color: COLORS.primary };

// New notifications are picked up this often while the screen is open.
const POLL_INTERVAL_MS = 20 * 1000;

const FILTER_OPTIONS = [
  { key: 'all', label: 'All', icon: 'grid', description: 'Show every notification', types: null },
  {
    key: 'deliveries',
    label: 'Deliveries',
    icon: 'truck',
    description: 'Handoffs and status updates',
    types: ['delivery_assigned', 'delivery_status_update', 'delivery_handoff_pending_sr', 'delivery_handoff_confirmed', 'delivery_handoff_disputed', 'delivery_completed', 'delivery_received', 'delivery_disputed_collector', 'collector_return_initiated', 'collector_return_received'],
  },
  {
    key: 'stockRequests',
    label: 'Stock Requests',
    icon: 'notePencil',
    description: 'Requests, releases and acceptances',
    types: ['stock_request_submitted', 'stock_request_resolved', 'stock_request_fulfilled', 'stock_released_to_you', 'stock_accepted'],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'clipboardText',
    description: 'Daily reports and discrepancies',
    types: ['daily_report_submitted', 'daily_report_accepted', 'discrepancy_found'],
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
//
// The cache key is shared by every account that signs in on this device, so
// each account's list is kept under its own id (byUser). Keeping only the
// last list meant a Manager opening this screen offline, after a Sales Rep
// had used the phone, found the Sales Rep's list cached and got nothing.
const loadNotificationsData = async (previous) => {
  const currentUser = await authService.getCurrentUser();
  const userId = currentUser?.id;
  const byUser = { ...(previous?.byUser || {}) };
  const result = await notificationService.getMyNotifications(userId);
  if (result.success && userId) {
    byUser[userId] = result.data;
  }
  const fallback = previous?.user?.id === userId ? previous?.notifications : null;
  return {
    user: currentUser,
    notifications: (userId && byUser[userId]) || fallback || [],
    byUser,
  };
};

export default function NotificationsScreen() {
  const navigation = useNavigation();
  // freshMs 0: always refetch when the screen is opened. Reusing a list up to
  // 30s old is what made a just-arrived notification look missing.
  const { data: snapshot, isLoading, refresh } = useCachedFocusLoader('notifications', loadNotificationsData, {
    freshMs: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => refresh({ force: true }), POLL_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [refresh])
  );

  const handlePullRefresh = async () => {
    setIsRefreshing(true);
    await refresh({ force: true });
    setIsRefreshing(false);
  };

  // Who is looking at the screen right now. The cached snapshot may have
  // been written by a different account, so it is never trusted for this.
  const [user, setUser] = useState(null);
  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  // Local copy so mark-as-read can update optimistically — reseeded from the
  // cached snapshot whenever it changes (a fresh load, or a background
  // refresh completing), same as the screen always did on every focus.
  const [notifications, setNotifications] = useState([]);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false);
  const [dateRange, setDateRange] = useState(null); // { from: Date, to: Date } | null

  useEffect(() => {
    if (!user?.id) return;
    const own = snapshot?.user?.id === user.id ? snapshot.notifications : snapshot?.byUser?.[user.id];
    setNotifications(own ?? []);
  }, [snapshot, user?.id]);

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

    // Offline, a Sales Rep's delivery opens from the copy saved on this phone
    // (Track Deliveries), with its Receive button, instead of failing.
    const isOfflineFailure = (message) => !getConnectionStatus().online || isNetworkError(message);
    const openSavedDelivery = async (wantReceive) => {
      const saved = await findSavedDelivery({ transactionId: targetTransactionId }, user?.id);
      if (!saved) {
        Alert.alert('Needs Internet', "This delivery isn't saved on this phone yet. Connect and try again.");
        return;
      }
      if (wantReceive && isReceivable(saved)) {
        navigation.navigate('SalesRepConfirmHandoff', confirmHandoffParams(saved));
      } else {
        navigation.navigate('SalesRepDeliveryDetail', { delivery: saved });
      }
    };

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
          if (isOfflineFailure(result.message)) return openSavedDelivery(true);
          Alert.alert('Unable to Load Handoff', friendlyError(result.message) || 'Please try again.');
          return;
        }

        const handoff = result.data.find(
          (pendingHandoff) => pendingHandoff.transactionId === targetTransactionId
        );
        if (handoff) {
          navigation.navigate('SalesRepConfirmHandoff', { handoff });
        } else if (findQueuedReceipt({ transactionId: targetTransactionId }, user.id)) {
          Alert.alert('Already Received', 'You already received this delivery on this phone. It completes automatically.');
        } else {
          // Already confirmed (or reported): show the delivery instead of a dead end.
          const saved = await findSavedDelivery({ transactionId: targetTransactionId }, user.id);
          if (saved) {
            navigation.navigate('SalesRepDeliveryDetail', { delivery: saved });
          } else {
            Alert.alert('Already Handled', 'You already confirmed this delivery. It is in your Track Deliveries.');
          }
        }
      } catch (error) {
        Alert.alert(
          'Unable to Load Handoff',
          friendlyError(error.message) || 'Please try again.'
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
          Alert.alert('Unable to Load Delivery', friendlyError(result.message) || 'Please try again.');
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
        Alert.alert('Unable to Load Delivery', friendlyError(error.message) || 'Please try again.');
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
          if (isOfflineFailure(result.message)) return openSavedDelivery(false);
          Alert.alert('Unable to Load Delivery', friendlyError(result.message) || 'Please try again.');
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
        Alert.alert('Unable to Load Delivery', friendlyError(error.message) || 'Please try again.');
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

        {isLoading || !user ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : visibleNotifications.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyScroll}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handlePullRefresh} colors={[COLORS.primary]} />
            }
          >
            <Icon name="notification" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {!isFilterActive ? 'No notifications yet.' : 'No notifications in this filter.'}
            </Text>
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handlePullRefresh} colors={[COLORS.primary]} />
            }
          >
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
                    <Icon
                      name={meta.icon}
                      size={18}
                      color={meta.color}
                      weight="duotone"
                      duotoneColor={meta.icon === 'returnBox' ? meta.color + '33' : null}
                    />
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
  emptyScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
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
