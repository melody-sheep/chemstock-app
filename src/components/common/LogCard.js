// src/components/common/LogCard.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * LogCard - single row for transaction/activity log lists.
 * Left accent stripe (3px) color-codes the log type; compact rounded-square
 * icon badge; inline title; relative time on the right.
 *
 * `type` drives the accent stripe + icon tint:
 *   'release'          → green  (stock leaving)
 *   'receive'          → cyan   (stock coming in)
 *   'delivery'         → green  (handoff completed)
 *   'report'           → purple (daily report submitted)
 *   'discrepancy'      → red    (variance flagged)
 *   'requestPending'   → gold
 *   'requestAccepted'  → green
 *   'requestDeclined'  → red
 */
export default function LogCard({
  type = 'receive',
  icon = null,
  title = '',
  meta = '',
  time = '',
  onPress = null,
  style = {},
}) {
  const meta_ = TYPE_META[type] || TYPE_META.receive;

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}, ${meta}, ${time}`}
    >
      <View style={[styles.stripe, { backgroundColor: meta_.accent }]} />

      <View style={[styles.iconBadge, { backgroundColor: meta_.badgeBg }]}>
        <Icon
          name={icon || meta_.icon}
          size={20}
          color={meta_.iconColor}
          weight="regular"
        />
      </View>

      <View style={styles.textCol}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!time && <Text style={styles.time}>{time}</Text>}
        </View>
        {!!meta && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

LogCard.propTypes = {
  type: PropTypes.oneOf([
    'release',
    'receive',
    'delivery',
    'report',
    'discrepancy',
    'requestPending',
    'requestAccepted',
    'requestDeclined',
  ]),
  icon: PropTypes.string,
  title: PropTypes.string.isRequired,
  meta: PropTypes.string,
  time: PropTypes.string,
  onPress: PropTypes.func,
  style: PropTypes.object,
};

const TYPE_META = {
  release: { accent: '#4c9f70', iconColor: '#4c9f70', badgeBg: '#4c9f7015', icon: 'arrowUpRight' },
  receive: { accent: '#00B4D8', iconColor: '#0096C7', badgeBg: '#CAF0F8', icon: 'arrowDownLeft' },
  delivery: { accent: '#4c9f70', iconColor: '#4c9f70', badgeBg: '#4c9f7015', icon: 'sealCheck' },
  report: { accent: '#6C5CE7', iconColor: '#6C5CE7', badgeBg: '#6C5CE715', icon: 'clipboardText' },
  discrepancy: { accent: '#dc3545', iconColor: '#dc3545', badgeBg: '#dc354515', icon: 'sealWarning' },
  requestPending: { accent: '#F2C94C', iconColor: '#B45309', badgeBg: '#F2C94C22', icon: 'clockCountdown' },
  requestAccepted: { accent: '#4c9f70', iconColor: '#4c9f70', badgeBg: '#4c9f7015', icon: 'checkCircle' },
  requestDeclined: { accent: '#dc3545', iconColor: '#dc3545', badgeBg: '#dc354515', icon: 'xCircle' },
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECEEF1',
    overflow: 'hidden',
  },
  stripe: { width: 3, alignSelf: 'stretch' },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  textCol: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
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
  time: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textTertiary,
  },
  meta: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontWeight: TYPOGRAPHY.fontWeight.regular,
    color: COLORS.textSecondary,
  },
});
