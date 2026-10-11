// src/styles/radius.js
// Border-radius scale, mirroring colors.js/spacing.js/typography.js.
// Kept as a small named scale so a card in one screen and a card in
// another can't silently drift to 10 vs 12 vs 14.
export const RADIUS = {
  xs: 4,     // tiny chips, badges
  sm: 6,     // compact controls
  md: 8,     // standard cards, tiles, photo frames
  lg: 12,    // panels, larger surfaces
  xl: 16,    // hero cards
  sheet: 30, // bottom-sheet top corners
  pill: 999, // fully-rounded pills
};

export default RADIUS;
