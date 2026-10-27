// src/components/common/ActionCard.js
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * ActionCard - Grid tile for dashboard "Main Operation" style menus.
 * Duotone icon (left) + title (right). Meant to be laid out in a 2-column
 * grid by the parent screen.
 */
export default function ActionCard({
  icon,
  iconColor = '#03045E',
  duotoneColor = null,
  title,
  onPress = null,
  style = {},
  badgeCount = 0,
  // 'tile': icon above the title, centred, for a 3-column grid. Default keeps the row layout.
  layout = 'row',
}) {
  const isTile = layout === 'tile';
  return (
    <TouchableOpacity
      style={[styles.card, isTile && styles.cardTile, style]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={badgeCount > 0 ? `${title}, ${badgeCount} pending` : title}
      accessibilityRole="button"
    >
      <Icon
        name={icon}
        size={28}
        color={iconColor}
        duotoneColor={duotoneColor}
        weight="duotone"
        style={isTile ? styles.iconTile : styles.icon}
      />
      <Text style={isTile ? styles.titleTile : styles.title} numberOfLines={isTile ? 2 : undefined}>{title}</Text>
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

ActionCard.propTypes = {
  icon: PropTypes.string.isRequired,
  iconColor: PropTypes.string,
  duotoneColor: PropTypes.string,
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func,
  style: PropTypes.object,
  badgeCount: PropTypes.number,
  layout: PropTypes.oneOf(['row', 'tile']),
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    padding: SPACING.sm,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
  cardTile: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
  },
  iconTile: { marginBottom: 6 },
  titleTile: {
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
  icon: {
    marginRight: SPACING.sm,
  },
  title: {
    flex: 1,
    flexWrap: 'wrap',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: '#272632',
  },
});
