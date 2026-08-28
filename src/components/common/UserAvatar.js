// src/components/common/UserAvatar.js
import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import Icon from './Icon';
import { TYPOGRAPHY } from '../../styles/typography';

/**
 * UserAvatar - shows a person's real profile photo if one has been set.
 * Without a photo, falls back to `fallbackText` (initials) when provided —
 * used for OTHER users shown in lists (agent rows, delivery recipients,
 * etc.) — or otherwise the generic icon glyph every screen already used
 * before this feature existed, which is what the CURRENT viewer's own
 * avatar (Header's Dashboard icon, each Settings screen, Edit Profile)
 * still uses (no `fallbackText` passed there, so behavior is unchanged).
 */
export default function UserAvatar({
  photoUrl = null,
  size = 40,
  iconName = 'person',
  iconColor = '#94a3b8',
  iconWeight = 'regular',
  backgroundColor = '#F1F3F6',
  fallbackText = null,
  fallbackTextColor = '#03045E',
  style = {},
}) {
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ]}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.image} resizeMode="cover" />
      ) : fallbackText ? (
        <Text style={[styles.fallbackText, { fontSize: Math.round(size * 0.4), color: fallbackTextColor }]}>
          {fallbackText}
        </Text>
      ) : (
        <Icon name={iconName} size={Math.round(size * 0.55)} color={iconColor} weight={iconWeight} />
      )}
    </View>
  );
}

UserAvatar.propTypes = {
  photoUrl: PropTypes.string,
  size: PropTypes.number,
  iconName: PropTypes.string,
  iconColor: PropTypes.string,
  iconWeight: PropTypes.string,
  backgroundColor: PropTypes.string,
  fallbackText: PropTypes.string,
  fallbackTextColor: PropTypes.string,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
  },
});
