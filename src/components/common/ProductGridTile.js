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
          <Icon name="checkmark" size={13} color={COLORS.textWhite} weight="bold" />
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
    gap: 4,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#C9CCD6',
    backgroundColor: COLORS.textWhite,
  },
  tileSelected: {
    borderColor: '#0085F9',
    backgroundColor: '#DCEBFF',
  },
  checkBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 0,
    backgroundColor: '#0085F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  thumb: {
    width: 56,
    height: 56,
    backgroundColor: 'transparent',
  },
  name: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
