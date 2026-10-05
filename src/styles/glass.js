// src/styles/glass.js
import { COLORS } from '../constants/colors';

// Glass surface for floating panels over a map or photo. Spread into a style
// object (e.g. `{ ...glassPanel, padding: 8 }`) so every overlay looks the same.
export const glassPanel = {
  backgroundColor: COLORS.glassSurface,
  borderWidth: 1,
  borderColor: COLORS.glassBorder,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 12,
  elevation: 6,
};
