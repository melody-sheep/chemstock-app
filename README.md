
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
- **Reusable Input Component** - With Phosphor icons and ref support
- **Reusable Button Component** - Primary (blue) and Black variants with shadow
- **Icon System** - Centralized Phosphor-style SVG icons (warningTriangle, user, lock, eye, eyeSlash)
- **Keyboard Handling** - KeyboardWrapper component with dismiss on tap outside
- **Inter Font Integration** - Google Fonts Inter loaded via expo-font
- **Remember Me Checkbox** - Interactive with visual feedback
- **Responsive Layout** - Proper spacing and touch targets for mobile UX

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

## 📁 Project Structure
Follows strict software engineering principles:
- Reusable components in `src/components/common/` (Button, Input, Modal, Icon, AnimatedTextDot, KeyboardWrapper)
- Single source of truth in `src/constants/` (colors.js)
- Centralized styles in `src/styles/` (typography.js, spacing.js)
- No hardcoded values - uses centralized constants

## 🎬 Animation Features
- **Typing Animation:** Text appears character by character
- **Reverse Animation:** Text disappears character by character (faster)
- **Color Cycling:** Background smoothly transitions through 6 greeting colors
- **Dynamic Speed:** Longer phrases type faster for consistent timing
- **Auto Loop:** Animation cycles through all phrases infinitely

## 🎨 UI Components Library

| Component | Location | Props |
|-----------|----------|-------|
| `Button` | `components/common/Button.js` | `variant` ('primary' / 'black'), `height`, `hasShadow` |
| `Input` | `components/common/Input.js` | `icon` ('user' / 'lock'), `inputRef`, `onSubmitEditing` |
| `Icon` | `components/common/Icon.js` | `name`, `size`, `color` |
| `AnimatedTextDot` | `components/common/AnimatedTextDot.js` | `data`, `loop`, `yOffset`, `textSize`, `dotSize` |
| `KeyboardWrapper` | `components/common/KeyboardWrapper.js` | `children` |
| `Modal` | `components/common/Modal.js` | `visible`, `onClose`, `height`, `backgroundColor` |

## 🎨 Available Icons
- `warningTriangle` - Danger/warning alert
- `user` - Username/account
- `lock` - Password/security
- `eye` - Show password
- `eyeSlash` - Hide password

## 📱 Login Screen Layout
```
┌─────────────────────────────────┐
│                                 │
│    🎬 Animated Text + Dot       │
│    (Cycling Greetings)          │
│                                 │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │ 👤 Username             │    │
│  └─────────────────────────┘    │
│  ┌─────────────────────────┐    │
│  │ 🔒 Password             │    │
│  └─────────────────────────┘    │
│                                 │
│  ☐ Remember Me                  │
│                                 │
│  ┌─────────────────────────┐    │
│  │        LOGIN            │    │
│  └─────────────────────────┘    │
│                                 │
│  Forgot Password?    ● Online   │
│                                 │
│  ⚠ Access is restricted to      │
│    authorized personnel only.   │
│                                 │
│  Manager Activation             │
└─────────────────────────────────┘
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

## 🔧 Installation & Setup

```bash
# Install dependencies
npm install

# Install expo-font for Inter font
npx expo install expo-font

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
  "@expo-google-fonts/inter": "latest"
}
```

## 👥 Team
Internal use only - authorized personnel

## 📞 Support
For issues or feature requests, contact the development team.

---
**© 2026 ChemStock - Securing the Chain of Custody**

*Version 1.0.0 - Pre-Release*
```

This README now includes:
- ✅ All completed features
- ✅ UI components library table
- ✅ Login screen layout diagram
- ✅ Available icons list
- ✅ Updated tech stack
- ✅ Installation instructions
- ✅ Development rules (preserved)

