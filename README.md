```markdown
# 🧪 ChemStock Mobile App

**Status:** 🚧 Under Active Development  
**Target Release:** 📅 October 2026

## 📱 About
ChemStock is a mobile inventory management system for chemical supply chain and custody tracking, designed specifically for Cospachem Products' distributed sales operations.

## 🎯 Current Status (Pre-Release)

### ✅ Completed Features
- **Login Screen UI** - Complete with static bottom sheet design
- **AnimatedTextDot Component** - Typing animation with color cycling
- **Smooth Color Cycling** - Transitions through 6 greeting phrases
- **Dynamic Typing Speed** - Speed adjusts based on text length
- **Fade In/Out Animation** - Smooth text transitions with reverse typing
- **Reusable Input Component** - With Phosphor icons, ref support, PropTypes, and JSDoc
- **Reusable Button Component** - Primary (blue) and Black variants with shadow, PropTypes, JSDoc
- **Icon System** - Centralized Phosphor-style SVG icons with PropTypes and validation
- **Keyboard Handling** - Keyboard dismissal on tap outside
- **Inter Font Integration** - Google Fonts Inter loaded via expo-font
- **Status Bar Configuration** - Visible with white icons on animated backgrounds
- **Responsive Layout** - Proper spacing, touch targets, and accessibility props
- **Error Handling** - Try/catch blocks and PropTypes for type safety

### 🔄 In Progress
- Authentication integration with Supabase
- Role-based access control (Manager, Sales Rep, Collector)
- Dashboard screens for each user role

### ⏳ Pending
- Inventory management features (receive, release, returns)
- QR code scanning and generation
- Photo handover documentation
- Geo-tagging and chain of custody
- Offline sync with SQLite
- Weekly reconciliation and discrepancy alerts

## 🚀 Release Timeline
**October 2026** - Full production release for Cagayan de Oro and Butuan branches

## 🛠️ Tech Stack
- **Frontend:** React Native / Expo
- **Animations:** React Native Animated API
- **Icons:** Custom SVG Phosphor-style icons
- **Fonts:** Inter (Google Fonts via expo-font)
- **Backend:** Supabase (PostgreSQL + Storage)
- **Navigation:** React Navigation
- **Offline:** SQLite (expo-sqlite)
- **Type Safety:** PropTypes
- **Accessibility:** Screen reader support

## 📁 Project Structure
Follows strict software engineering principles:
- Reusable components in `src/components/common/` (Button, Input, Modal, Icon, AnimatedTextDot, KeyboardWrapper)
- Single source of truth in `src/constants/` (colors.js)
- Centralized styles in `src/styles/` (typography.js, spacing.js)
- No hardcoded values - uses centralized constants
- PropTypes for runtime type checking
- JSDoc comments for documentation
- Accessibility props for all interactive elements

## 🎬 Animation Features
- **Typing Animation:** Text appears character by character
- **Reverse Animation:** Text disappears character by character (faster)
- **Color Cycling:** Background smoothly transitions through 6 greeting colors
- **Dynamic Speed:** Longer phrases type faster for consistent timing
- **Auto Loop:** Animation cycles through all phrases infinitely

## 🎨 UI Components Library

| Component | Location | Props | Documentation |
|-----------|----------|-------|---------------|
| `Button` | `components/common/Button.js` | `variant` ('primary'/'black'), `height`, `hasShadow` | PropTypes + JSDoc |
| `Input` | `components/common/Input.js` | `icon` ('user'/'lock'), `inputRef`, `onSubmitEditing`, `error` | PropTypes + JSDoc |
| `Icon` | `components/common/Icon.js` | `name`, `size`, `color` | PropTypes + JSDoc |
| `AnimatedTextDot` | `components/common/AnimatedTextDot.js` | `data`, `loop`, `yOffset`, `textSize`, `dotSize` | JSDoc |
| `KeyboardWrapper` | `components/common/KeyboardWrapper.js` | `children` | JSDoc |
| `Modal` | `components/common/Modal.js` | `visible`, `onClose`, `height`, `backgroundColor` | Basic |

## 🎨 Available Icons

| Icon Name | Description | Usage |
|-----------|-------------|-------|
| `warningTriangle` | Danger/warning alert | `<Icon name="warningTriangle" size={14} color="#FF0000" />` |
| `user` | Username/account | `<Icon name="user" size={20} color="#757575" />` |
| `lock` | Password/security | `<Icon name="lock" size={20} color="#757575" />` |
| `eye` | Show password | `<Icon name="eye" size={20} color="#757575" />` |
| `eyeSlash` | Hide password | `<Icon name="eyeSlash" size={20} color="#757575" />` |

## 🔧 Installation & Setup

```bash
# Install dependencies
npm install

# Install PropTypes for type checking
npm install prop-types

# Install Safe Area Context for status bar handling
npm install react-native-safe-area-context

# Install expo-font for Inter font
npx expo install expo-font

# Install Google Fonts Inter
npm install @expo-google-fonts/inter

# Start development server
npx expo start --tunnel

# Scan QR code with Expo Go app on Android phone
```

## 📦 Dependencies

```json
{
  "expo": "~56.0.11",
  "react-native": "0.85.3",
  "phosphor-react-native": "^3.0.6",
  "@react-navigation/native": "^7.3.1",
  "expo-font": "latest",
  "@expo-google-fonts/inter": "latest",
  "prop-types": "latest",
  "react-native-safe-area-context": "latest"
}
```

## ⚠️ Development Rules (CRITICAL)

### NEVER DELETE:
- `src/constants/colors.js` - single source for ALL colors
- `src/styles/typography.js` - single source for ALL fonts
- `src/styles/spacing.js` - single source for ALL spacing
- `src/components/common/` - reusable components

### ALWAYS FOLLOW:
- ❌ NEVER hardcode colors, fonts, or spacing
- ❌ NEVER create duplicate constants
- ❌ NEVER import from `styles/colors.js` (deprecated)
- ✅ ALWAYS import from `constants/colors.js`, `styles/typography.js`, `styles/spacing.js`
- ✅ ALWAYS use reusable components from `components/common/`
- ✅ ALWAYS extract logic into custom hooks
- ✅ ALWAYS use the `Icon` component for custom icons
- ✅ ALWAYS add PropTypes to reusable components
- ✅ ALWAYS add JSDoc comments for functions and components
- ✅ ALWAYS include accessibility props (accessibilityLabel, accessibilityRole)
- ✅ ALWAYS use try/catch for error handling in critical functions

### DEPRECATED (DO NOT USE):
- `src/styles/colors.js` (delete this file if exists)

## 📱 Login Screen Features
- Animated greeting text with 6 cycling phrases
- Username field with user icon
- Password field with lock icon and show/hide toggle
- Black login button with shadow
- Forgot password link
- Online status indicator
- Security notice with warning icon
- Manager activation link
- Keyboard dismissal on outside tap
- Proper status bar visibility (white icons)

## 👥 Team
Internal use only - authorized personnel

## 📞 Support
For issues or feature requests, contact the development team.

---
**© 2026 ChemStock - Securing the Chain of Custody**

*Version 1.0.0 - Pre-Release*
```