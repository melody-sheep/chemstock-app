// src/components/common/ProductChip.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

const CHIP_RADIUS = 8;

/**
 * ProductChip - one card in the "Selected Products" horizontal row: a
 * white, lightly-rounded frame with an order number tag flush in the
 * top-left corner and a remove tag flush in the top-right corner (both
 * aligned to the frame's own border, no floating badges), plus a product
 * thumbnail + name. Used identically by AddNewBatchesScreen and
 * ProductPickerList — extracted so the two never drift out of sync again.
 */
export default function ProductChip({ index, name, image = null, onRemove }) {
  return (
    <View style={styles.chip}>
      <View style={styles.indexBadge}>
        <Text style={styles.indexBadgeText}>{index + 1}</Text>
      </View>

      <TouchableOpacity
        style={styles.chipRemove}
        onPress={onRemove}
        activeOpacity={0.7}
        accessibilityLabel={`Remove ${name}`}
        accessibilityRole="button"
      >
        <Icon name="xCircle" size={14} color={COLORS.error} weight="regular" />
      </TouchableOpacity>

      <View style={styles.chipContent}>
        <View style={styles.chipThumbWrap}>
          <Image source={image || PLACEHOLDER_IMAGE} style={styles.chipThumb} resizeMode="contain" />
        </View>
        <Text style={styles.chipName} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
}

ProductChip.propTypes = {
  index: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  image: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  onRemove: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  chip: {
    width: 92,
    height: 80,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: CHIP_RADIUS,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  indexBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderTopLeftRadius: CHIP_RADIUS,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  indexBadgeText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: '#FFFFFF',
  },
  chipRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderTopRightRadius: CHIP_RADIUS,
    borderBottomLeftRadius: 6,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  chipContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  chipThumbWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipThumb: {
    width: 38,
    height: 38,
  },
  chipName: {
    marginTop: 6,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: '#272632',
    textAlign: 'center',
  },
});
