# 📁 UPDATED README.md - ChemStock Mobile App

```markdown
# 🧪 ChemStock Mobile App

**Status:** 🚧 Under Active Development  
**Target Release:** 📅 October 2026

## 📱 About
ChemStock is a mobile inventory management system for chemical supply chain and custody tracking, designed specifically for Cospachem Products' distributed sales operations.

## 🎯 Current Status (Pre-Release)

### ✅ Completed Features
- **Login Screen UI** - Complete with static bottom sheet design
- **Manager Activation Screen** - Header with back button, online status, activation code validation (4-digit), branch list display
- **Reusable Card Component** - Secondary frame with border (#555353), custom background, auto-height
- **Reusable Header Component** - Primary header with back button, online status, title support
- **ScreenContainer Component** - Wraps screens with consistent 16px margins
- **AnimatedTextDot Component** - Typing animation with color cycling through 6 phrases
- **Smooth Color Cycling** - Transitions through 6 greeting phrases
- **Dynamic Typing Speed** - Speed adjusts based on text length
- **Fade In/Out Animation** - Smooth text transitions with reverse typing
- **Reusable Input Component** - With Phosphor icons, ref support, rightIcon support, PropTypes, JSDoc
- **Reusable Button Component** - Primary (blue) and Black variants with shadow, PropTypes, JSDoc
- **Icon System** - Centralized Phosphor-style SVG icons with PropTypes validation (10 icons)
- **Keyboard Handling** - Keyboard dismissal on tap outside
- **Inter Font Integration** - Google Fonts Inter loaded via expo-font
- **Status Bar Configuration** - Visible with white icons on animated backgrounds
- **Responsive Layout** - Proper spacing, touch targets, accessibility props
- **Error Handling** - Try/catch blocks, PropTypes, centralized logger
- **Navigation Setup** - Stack navigation between Login and ManagerActivation screens

### 🏗️ OOP Architecture (NEW)
- **BaseService Abstract Class** - All services extend this with retry logic, timeout handling, HTTP methods
- **MVVM Pattern** - useAuth and useActivation hooks separate UI from business logic
- **Strategy Pattern** - ValidationStrategies for reusable form validation (ActivationKey, Username, Password)
- **Dependency Injection** - container.js for service management (Singleton pattern)
- **Centralized Logging** - logger.js with debug/info/warn/error levels and timestamps
- **Single Responsibility** - Screens: UI only (180-200 lines), Hooks: state+logic, Services: API calls
- **AuthService** - Login, logout, token management (extends BaseService)
- **ActivationService** - Key validation, branch fetching, manager activation (extends BaseService)

### 🔄 In Progress
- Authentication integration with Supabase/Express.js backend
- Role-based access control (Manager, Sales Rep, Collector)
- Dashboard screens for each user role
- Database table creation (users, branches, activation_keys, inventory)

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
- **Icons:** Custom SVG Phosphor-style icons (10 icons available)
- **Fonts:** Inter (Google Fonts via expo-font)
- **Backend:** Supabase (PostgreSQL + Storage) + Express.js (planned)
- **Navigation:** React Navigation
- **Offline:** SQLite (expo-sqlite)
- **Type Safety:** PropTypes
- **Accessibility:** Screen reader support
- **SVG:** react-native-svg
- **OOP Patterns:** BaseService, MVVM, Strategy, Singleton, Dependency Injection

## 📁 Project Structure
Follows strict OOP software engineering principles:

```
src/
├── components/common/     # Reusable UI components (12 components)
├── constants/             # Single source of truth (colors.js, roles.js)
├── hooks/                 # MVVM custom hooks (useAuth, useActivation, useKeyboard)
├── navigation/            # Stack navigation
├── screens/auth/          # LoginScreen, ManagerActivationScreen
├── services/              # BaseService, authService, activationService
├── styles/                # typography.js, spacing.js, globalStyles.js
└── utils/                 # container.js, logger.js, validationStrategies.js
```

### Core Principles:
- No hardcoded values - uses centralized constants
- PropTypes for runtime type checking
- JSDoc comments for documentation
- Accessibility props for all interactive elements
- Screens under 200 lines (UI only)
- Services extend BaseService
- Validation uses Strategy Pattern

## 🎬 Animation Features
- **Typing Animation:** Text appears character by character
- **Reverse Animation:** Text disappears character by character (faster)
- **Color Cycling:** Background smoothly transitions through 6 greeting colors
- **Dynamic Speed:** Longer phrases type faster for consistent timing
- **Auto Loop:** Animation cycles through all phrases infinitely

## 🎨 UI Components Library

| Component | Location | Status | Features |
|-----------|----------|--------|----------|
| `Button` | `components/common/Button.js` | ✅ Complete | `variant` ('primary'/'black'), `height`, `hasShadow`, `width`, `loading`, `disabled` |
| `Input` | `components/common/Input.js` | ✅ Complete | `icon` ('user'/'lock'/'key'), `rightIcon`, `onRightIconPress`, `inputRef`, `onSubmitEditing`, `error`, `secureTextEntry`, `label`, `required` |
| `Icon` | `components/common/Icon.js` | ✅ Complete | `name`, `size`, `color` - 10 icons available |
| `Header` | `components/common/Header.js` | ✅ Complete | `showBackButton`, `backButtonText`, `showOnlineStatus`, `title`, `height`, `backgroundColor`, `textColor` |
| `Card` | `components/common/Card.js` | ✅ Complete | `backgroundColor`, `borderColor` (#555353 default), `borderWidth` (0.5), `borderRadius`, `marginTop`, `paddingVertical`, `hasShadow` |
| `ScreenContainer` | `components/common/ScreenContainer.js` | ✅ Complete | `scrollable`, `horizontalPadding`, `verticalPadding`, `backgroundColor` |
| `AnimatedTextDot` | `components/common/AnimatedTextDot.js` | ✅ Complete | `data`, `loop`, `yOffset`, `textSize`, `dotSize` |
| `KeyboardWrapper` | `components/common/KeyboardWrapper.js` | ✅ Complete | `children` |
| `Modal` | `components/common/Modal.js` | ✅ Complete | `visible`, `onClose`, `height`, `backgroundColor` |

## 🎨 Available Icons (10 icons)

| Icon Name | Description | Usage |
|-----------|-------------|-------|
| `warningTriangle` | Danger/warning alert | `<Icon name="warningTriangle" size={14} color="#FF0000" />` |
| `user` | Username/account | `<Icon name="user" size={20} color="#757575" />` |
| `lock` | Password/security/lock with keyhole | `<Icon name="lock" size={18} color={COLORS.textPrimary} />` |
| `eye` | Show password | `<Icon name="eye" size={20} color="#757575" />` |
| `eyeSlash` | Hide password | `<Icon name="eyeSlash" size={20} color="#757575" />` |
| `arrowLeft` | Back navigation (bold/thick) | `<Icon name="arrowLeft" size={24} color="#FFFFFF" />` |
| `key` | Activation key icon | `<Icon name="key" size={24} color={COLORS.textPrimary} />` |
| `send` | Paper plane / submit icon | `<Icon name="send" size={20} color="#03045E" />` |
| `checkmark` | Success/verification | `<Icon name="checkmark" size={18} color={COLORS.success} />` |
| `lockKeyhole` | Lock with keyhole | `<Icon name="lockKeyhole" size={18} color={COLORS.textPrimary} />` |

## 📱 Screens

### Login Screen (180 lines - UI only)
- Animated greeting text with 6 cycling phrases
- Username field with user icon
- Password field with lock icon and show/hide toggle
- Black login button with shadow and loading state
- Forgot password link
- Online status indicator
- Security notice with warning icon
- Manager activation link (navigates to ManagerActivationScreen)
- Keyboard dismissal on outside tap
- Proper status bar visibility (white icons)
- **Uses useAuth hook for state management (MVVM)**

### Manager Activation Screen (150 lines - UI only)
- **Header Component:** Dark blue (#03045E), back button, online status
- **Card Component (Secondary Frame):** Border 0.5px solid #555353, background #F7FEFF
- **Title:** "Manager Account Setup" (18px, bold, #272632)
- **Subtitle:** "Enter the activation key from the developer to register your branch." (12px, #555353)
- **Activation Code Input:** 4-digit numeric field with send icon button (right side, #03045E)
- **Location & Branch Lock Section:** Title + lock icon, description text
- **Branch List Display:** Shows CDO Branch and Butuan Branch with checkmark icons (#4c9f70) after valid code
- **Validation:** Format check (4 digits), mock validation for "2026"
- **Uses useActivation hook for state management (MVVM)**

## 🔧 Installation & Setup

```bash
# Install dependencies
npm install

# Install PropTypes for type checking
npm install prop-types

# Install Safe Area Context for status bar handling
npm install react-native-safe-area-context

# Install SVG support
npm install react-native-svg

# Install expo-font for Inter font
npx expo install expo-font

# Install Google Fonts Inter
npm install @expo-google-fonts/inter

# Start development server
npx expo start --clear

# Scan QR code with Expo Go app on Android phone
```

## 📦 Dependencies

```json
{
  "expo": "~56.0.11",
  "react-native": "0.85.3",
  "react-native-svg": "latest",
  "phosphor-react-native": "^3.0.6",
  "@react-navigation/native": "^7.3.1",
  "@react-navigation/native-stack": "^7.3.1",
  "expo-font": "latest",
  "@expo-google-fonts/inter": "latest",
  "prop-types": "latest",
  "react-native-safe-area-context": "latest"
}
```

## 🧭 Navigation Structure

```javascript
Stack Navigator
├── LoginScreen (initial route)
└── ManagerActivationScreen
```

## ⚠️ Development Rules (CRITICAL)

### NEVER DELETE:
- `src/constants/colors.js` - single source for ALL colors
- `src/styles/typography.js` - single source for ALL fonts
- `src/styles/spacing.js` - single source for ALL spacing
- `src/components/common/` - reusable components
- `src/services/BaseService.js` - all services must extend this
- `src/utils/container.js` - dependency injection
- `src/utils/logger.js` - centralized logging

### ALWAYS FOLLOW:
- ❌ NEVER hardcode colors, fonts, or spacing
- ❌ NEVER create duplicate constants
- ❌ NEVER put business logic in screens (use hooks)
- ❌ NEVER call APIs directly from screens (use services)
- ✅ ALWAYS import from `constants/colors.js`, `styles/typography.js`, `styles/spacing.js`
- ✅ ALWAYS use reusable components from `components/common/`
- ✅ ALWAYS extract logic into custom hooks (MVVM)
- ✅ ALWAYS use the `Icon` component for custom icons
- ✅ ALWAYS add PropTypes to reusable components
- ✅ ALWAYS add JSDoc comments for functions and components
- ✅ ALWAYS include accessibility props (accessibilityLabel, accessibilityRole)
- ✅ ALWAYS use try/catch with logError() from logger.js
- ✅ ALWAYS extend BaseService for new services

### OOP PRINCIPLES TO MAINTAIN:
- **SRP** - Screens = UI only, Hooks = business logic, Services = API calls
- **OCP** - Extend BaseService, don't modify it
- **DIP** - Use container.js for dependency injection
- **Strategy** - Use validationStrategies for form validation
- **MVVM** - ViewModels in hooks separate UI from logic

### DEPRECATED (DO NOT USE):
- `src/styles/colors.js` (delete this file if exists)

## 📝 Component Usage Examples

### Header Component
```jsx
// Basic back button
<Header showBackButton={true} backButtonText="Back" />

// With online status
<Header 
  showBackButton={true} 
  backButtonText="Back to Login"
  showOnlineStatus={true}
/>

// Custom colors
<Header 
  backgroundColor="#03045E"
  textColor="#FFFFFF"
  height={56}
/>
```

### Card Component
```jsx
// Basic card with default styling (border #555353)
<Card>
  <Text>Content here</Text>
</Card>

// Compact card with no margins and no roundness
<Card 
  marginTop={0} 
  marginHorizontal={0} 
  paddingVertical={SPACING.md}
  borderRadius={0}
>
  <Text>Compact content</Text>
</Card>
```

### ScreenContainer Component
```jsx
// Non-scrollable screen
<ScreenContainer>
  <Text>Content with 16px margins</Text>
</ScreenContainer>

// Scrollable screen
<ScreenContainer scrollable={true}>
  <Text>Long content that scrolls</Text>
</ScreenContainer>

// Full width (no horizontal padding)
<ScreenContainer horizontalPadding={0}>
  <Header />
  <Card marginHorizontal={0} />
</ScreenContainer>
```

### Input with Right Icon
```jsx
<Input
  label="Activation Code"
  required={true}
  placeholder="Enter 4-digit code"
  value={activationKey}
  onChangeText={setActivationKey}
  keyboardType="numeric"
  rightIcon={<Icon name="send" size={20} color="#03045E" />}
  onRightIconPress={handleSubmit}
/>
```

## 🎯 Current File Structure Status

```
src/
├── components/common/
│   ├── AnimatedTextDot.js     ✅
│   ├── Button.js              ✅
│   ├── Card.js                ✅
│   ├── Header.js              ✅
│   ├── Icon.js                ✅ (10 icons)
│   ├── Input.js               ✅ (rightIcon support)
│   ├── KeyboardWrapper.js     ✅
│   ├── Modal.js               ✅
│   └── ScreenContainer.js     ✅
│
├── constants/
│   ├── colors.js              ✅
│   └── roles.js               ✅
│
├── hooks/
│   ├── useActivation.js       🆕 (MVVM - 160 lines)
│   ├── useAuth.js             ✅ (MVVM - 160 lines)
│   └── useKeyboard.js         ✅
│
├── navigation/
│   └── AppNavigator.js        ✅
│
├── screens/auth/
│   ├── LoginScreen.js         ✅ (180 lines - UI only)
│   └── ManagerActivationScreen.js  ✅ (150 lines - UI only)
│
├── services/
│   ├── activationService.js   🆕 (extends BaseService)
│   ├── authService.js         ✅ (extends BaseService)
│   ├── BaseService.js         🆕 (Abstract class)
│   └── supabaseClient.js      ✅
│
├── styles/
│   ├── globalStyles.js        ✅
│   ├── spacing.js             ✅
│   └── typography.js          ✅
│
└── utils/
    ├── container.js           🆕 (DI container)
    ├── logger.js              🆕 (Centralized logging)
    ├── storage.js             ✅
    ├── validationStrategies.js 🆕 (Strategy pattern)
    └── validators.js          ✅
```

## 👥 Team
Internal use only - authorized personnel

## 📞 Support
For issues or feature requests, contact the development team.

---
**© 2026 ChemStock - Securing the Chain of Custody**

*Version 1.0.0 - Pre-Release (OOP Architecture Phase Complete)*
```