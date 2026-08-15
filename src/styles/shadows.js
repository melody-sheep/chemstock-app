// src/styles/shadows.js
import { Platform } from 'react-native';

/**
 * Single source for card shadow recipes, mirroring colors.js/spacing.js/typography.js.
 * Each token bundles the iOS shadow* props, Android elevation, and the web
 * boxShadow equivalent so callers never hand-roll all four again.
 */
export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      },
    }),
  },
  cardSoft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      },
    }),
  },
};

export default SHADOWS;
