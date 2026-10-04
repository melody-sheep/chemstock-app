// src/components/common/ProductGridTile.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../styles/spacing';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

// Selectable product tile for picker grids; a check badge marks the selected state.
export default function ProductGridTile({ product, selected, onPress, width }) {
  return (
    <TouchableOpacity
      style={[styles.tile, { width }, selected && styles.tileSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      {selected && (
        <View style={styles.checkBadge}>
          <Icon name="checkmark" size={10} color={COLORS.textWhite} />
        </View>
      )}
      <Image source={product.image || PLACEHOLDER_IMAGE} style={styles.thumb} resizeMode="contain" />
      <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
    </TouchableOpacity>
  );
}

ProductGridTile.propTypes = {
  product: PropTypes.shape({
    code: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image: PropTypes.any,
  }).isRequired,
  selected: PropTypes.bool,
  onPress: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
};

ProductGridTile.defaultProps = {
  selected: false,
};

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    gap: 2,
    padding: SPACING.xs,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.textWhite,
  },
  tileSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  checkBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  thumb: {
    width: 48,
    height: 48,
    backgroundColor: COLORS.textWhite,
  },
  name: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.textPrimary,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
