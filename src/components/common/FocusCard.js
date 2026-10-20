// src/components/common/FocusCard.js
// The card at the top of a dashboard that says what to do first: a title and
// a few tappable rows (icon, label, value, tone), or a calm "all caught up"
// line when nothing needs doing. Tap the title bar to fold it to one slim
// line (the open/closed choice is remembered). Shared by the Manager
// ("Needs attention"), Sales Rep ("Today") and Collector dashboards.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import storage from '../../utils/storage';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const TONES = {
  alert: { color: COLORS.error, bg: COLORS.error + '14' },
  warn: { color: '#B45309', bg: '#FFF3D6' },
  good: { color: COLORS.success, bg: COLORS.success + '1A' },
  info: { color: COLORS.primary, bg: '#EEF0FF' },
};
const STORAGE_PREFIX = 'chemstock_focus_card:';

export default function FocusCard({ title, icon = 'sealCheck', rows, emptyText, storageKey }) {
  const [open, setOpen] = useState(true);
  const visible = rows.filter(Boolean);
  // Rows that ask the person to do something (shown as chips when folded).
  const todo = visible.filter((row) => row.tone === 'warn' || row.tone === 'alert');

  useEffect(() => {
    let active = true;
    storage.get(STORAGE_PREFIX + (storageKey || title)).then((saved) => {
      if (active && saved === false) setOpen(false);
    });
    return () => {
      active = false;
    };
  }, [storageKey, title]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    storage.set(STORAGE_PREFIX + (storageKey || title), next);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.head}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${open ? 'tap to hide' : 'tap to show'}`}
      >
        <Icon name={icon} size={14} color={COLORS.primary} />
        <Text style={styles.title}>{title}</Text>

        <View style={styles.summary}>
          {!open &&
            (todo.length > 0 ? (
              todo.map((row) => {
                const tone = TONES[row.tone];
                return (
                  <View key={row.key} style={[styles.chip, { backgroundColor: tone.bg }]}>
                    <Icon name={row.icon} size={11} color={tone.color} />
                    <Text style={[styles.chipText, { color: tone.color }]} numberOfLines={1}>{row.value}</Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.chip}>
                <Icon name="checkCircle" size={12} color={COLORS.success} />
                <Text style={[styles.chipText, { color: COLORS.success }]}>All good</Text>
              </View>
            ))}
        </View>

        <View style={open && styles.chevronOpen}>
          <Icon name="caretDown" size={14} color={COLORS.textSecondary} />
        </View>
      </TouchableOpacity>

      {open &&
        (visible.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="checkCircle" size={14} color={COLORS.success} />
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : (
          visible.map((row) => {
            const tone = TONES[row.tone] || TONES.info;
            const content = (
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                  <Icon name={row.icon} size={12} color={tone.color} />
                </View>
                <Text style={styles.rowLabel} numberOfLines={1}>{row.label}</Text>
                <Text style={[styles.rowValue, { color: tone.color }]} numberOfLines={1}>{row.value}</Text>
                {row.onPress && <Icon name="arrowRight" size={12} color={COLORS.textSecondary} />}
              </View>
            );
            return row.onPress ? (
              <TouchableOpacity key={row.key} onPress={row.onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${row.label}: ${row.value}`}>
                {content}
              </TouchableOpacity>
            ) : (
              <View key={row.key}>{content}</View>
            );
          })
        ))}
    </View>
  );
}

FocusCard.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.string,
  rows: PropTypes.array.isRequired,
  emptyText: PropTypes.string.isRequired,
  storageKey: PropTypes.string,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38 },
  title: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#272632',
  },
  summary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, overflow: 'hidden' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, height: 22, borderRadius: 11 },
  chipText: { fontSize: 12, fontFamily: TYPOGRAPHY.fontFamily.bold, fontWeight: TYPOGRAPHY.fontWeight.bold },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  rowIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: '#272632',
  },
  rowValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  emptyText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: COLORS.textSecondary,
  },
});
