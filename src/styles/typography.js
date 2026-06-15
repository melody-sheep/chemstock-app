// src/styles/typography.js
export const TYPOGRAPHY = {
  fontFamily: {
    regular: 'Inter',
    medium: 'Inter',
    semibold: 'Inter',
    bold: 'Inter',
  },
  fontSize: {
    xs: 12,      // Extra small (captions, helper text, error messages, timestamps)
    sm: 14,      // Small (secondary text, subtitles, descriptions)
    base: 16,    // BASE (labels, form fields, body text) → MEDIUM weight
    lg: 18,      // Large (titles, headings) → SEMIBOLD weight (1st font)
    xl: 20,      // Extra large (section headers) → SEMIBOLD weight
    '2xl': 24,   // 2X Large (screen titles) → SEMIBOLD weight
    '3xl': 28,   // 3X Large (hero text) → SEMIBOLD weight
    '4xl': 32,   // 4X Large (onboarding titles) → SEMIBOLD weight
  },
  fontWeight: {
    regular: '400',
    medium: '500',    // Used for 16px (base) - 2nd font
    semibold: '600',  // Used for 18px and above - 1st font
    bold: '700',
  },
};