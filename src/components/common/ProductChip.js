// src/components/common/ProductChip.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { COLORS } from '../../constants/colors';
import { TYPOGRAPHY } from '../../styles/typography';

const PLACEHOLDER_IMAGE = require('../../../assets/image/empty_box1.png');

/**
 * ProductChip - one card in the "Selected Products" horizontal row: order
 * number top-left, remove badge overlapping the top-right corner, tinted
 * product thumbnail, and name. Used identically by AddNewBatchesScreen and
 * ProductPickerList — extracted so the two never drift out of sync again.
 */
export default function ProductChip({ index, name, image = null, tint = null, onRemove }) {
  return (
    <View style={styles.chip}>
      <View style={styles.indexBadge}>
        <Text style={styles.indexBadgeText}>{index + 1}</Text>
      </View>
      <TouchableOpacity
        style={styles.chipRemove}
        onPress={onRemove}
        accessibilityLabel={`Remove ${name}`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="xCircle" size={26} color={COLORS.error} weight="fill" />
      </TouchableOpacity>
      <View style={[styles.chipThumbWrap, { backgroundColor: tint || '#F1F5F9' }]}>
        <Image source={image || PLACEHOLDER_IMAGE} style={styles.chipThumb} resizeMode="contain" />
      </View>
      <Text style={styles.chipName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

ProductChip.propTypes = {
  index: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  image: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  tint: PropTypes.string,
  onRemove: PropTypes.func.isRequired,
};

const styles = StyleSheet.create({
  chip: {
    width: 95,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 8,
    alignItems: 'center',
  },
  indexBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 6,
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
    top: -10,
    right: -10,
    zIndex: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  chipThumbWrap: {
    width: '100%',
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
