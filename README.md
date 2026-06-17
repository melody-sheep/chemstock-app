# 📁 CHEMSTOCK-MOBILE/ - COMPLETE PROJECT STRUCTURE

```
📱 CHEMSTOCK-MOBILE/
│
├── 🤖 .claude/
│   └── settings.json                                 # Claude AI configuration
│
├── 🚫 .expo/                                         # Expo build cache
│
├── 📦 .git/                                          # Git version control
│
├── 📁 admin-cli/                                     🆕 ADMIN CLI TOOL
│   ├── .env                                          # Supabase credentials
│   ├── index.js                                      # CLI entry point - launches web UI
│   ├── server.js                                     # Express server for web UI
│   ├── package.json                                  # CLI dependencies
│   ├── install.bat                                   # Windows installer
│   ├── package-lock.json                             # Locked dependencies
│   ├── node_modules/                                 # CLI dependencies
│   ├── 📁 config/
│   │   └── supabase.js                               # Supabase client with service role
│   ├── 📁 utils/
│   │   └── crypto.js                                 # Secure random code generator
│   └── 📁 web-ui/                                    # Web dashboard UI
│       ├── index.html                                # Main dashboard page
│       ├── style.css                                 # Material Design styles
│       └── script.js                                 # Dashboard logic
│
├── 🎨 assets/                                         # STATIC ASSETS
│   ├── 🖼️ image/
│   │   ├── chemstock_png.png                         # App logo
│   │   └── empty_box1.png                            # Empty state image
│   ├── 📱 android-icon-background.png                # Android adaptive icon bg
│   ├── 🤖 android-icon-foreground.png                # Android adaptive icon fg
│   ├── 🎨 android-icon-monochrome.png                # Android monochrome icon
│   ├── 🌐 favicon.png                                # Web favicon
│   ├── 📲 icon.png                                   # App icon
│   └── 🚀 splash-icon.png                            # Splash screen icon
│
├── 📁 src/                                            MAIN SOURCE CODE
│   │
│   ├── 📄 container.js                               ✅ DEPENDENCY INJECTION CONTAINER
│   │   # Singleton pattern for service management
│   │   # Registers: authService, activationService
│   │   # Used for: Lazy loading, dependency resolution
│   │
│   ├── 🧩 components/                                 REUSABLE UI COMPONENTS
│   │   │
│   │   ├── 📸 camera/                                 (empty - future QR scanning)
│   │   ├── 📦 inventory/                              (empty - future inventory)
│   │   ├── 🗺️ maps/                                   (empty - future GPS tracking)
│   │   ├── 📱 qr/                                     (empty - future QR generation)
│   │   │
│   │   ├── 🔧 common/                                 ✅ 9 REUSABLE COMPONENTS
│   │   │   ├── AnimatedTextDot.js                     # Animated text cycling (login)
│   │   │   ├── Button.js                              # Button with variants + PropTypes
│   │   │   ├── Card.js                                # Card container component
│   │   │   ├── Header.js                              # App header with back button
│   │   │   ├── Icon.js                                # SVG icon system (Phosphor)
│   │   │   ├── Input.js                               # Form input with validation
│   │   │   ├── KeyboardWrapper.js                     # Keyboard avoidance wrapper
│   │   │   ├── Modal.js                               # Bottom sheet modal
│   │   │   └── ScreenContainer.js                     # Screen wrapper with 16px margins
│   │   │
│   │   └── 🎯 ui/                                     ✅ 3 UI HELPER COMPONENTS
│   │       ├── Divider.js                             # Horizontal divider line
│   │       ├── LoadingSpinner.js                      # Loading indicator
│   │       └── Logo.js                                # Logo component
│   │
│   ├── 📋 constants/                                  APP CONSTANTS
│   │   ├── colors.js                                  ✅ SINGLE SOURCE for ALL colors
│   │   │   # All color definitions (primary, secondary, text, background, etc.)
│   │   └── roles.js                                   # User role constants
│   │       # manager, sales_rep, collector, admin
│   │
│   ├── 🔄 contexts/                                   (empty - using hooks instead of Context)
│   │
│   ├── 🪝 hooks/                                      ✅ 3 CUSTOM HOOKS (MVVM Pattern)
│   │   ├── useActivation.js                           # Activation ViewModel
│   │   │   # Handles: validation, branch display, activation state
│   │   │   # Uses: activationService, validationStrategies
│   │   ├── useAuth.js                                 # Auth ViewModel
│   │   │   # Handles: login, logout, session, user state
│   │   │   # Uses: authService, validationStrategies
│   │   └── useKeyboard.js                             # Keyboard visibility tracker
│   │       # Detects keyboard show/hide events
│   │
│   ├── 🧭 navigation/                                 NAVIGATION CONFIGURATION
│   │   ├── AppNavigator.js                            # Main navigation container
│   │   │   # Root navigator with all screens
│   │   └── AuthStack.js                               # Authentication stack
│   │       # Login → ManagerActivation → Dashboard
│   │
│   ├── 📺 screens/                                    APP SCREENS
│   │   │
│   │   ├── 🔐 auth/                                   ✅ 2 AUTH SCREENS
│   │   │   ├── LoginScreen.js                         # Login screen (UI only - 180 lines)
│   │   │   │   # Uses: useAuth hook, AnimatedTextDot, Input, Button
│   │   │   └── ManagerActivationScreen.js             # Activation screen (UI only - 150 lines)
│   │   │       # Uses: activationService, displays branches with checkmarks
│   │   │
│   │   ├── 📦 collector/                              (empty - future collector dashboard)
│   │   ├── 🔄 common/                                 (empty - future common screens)
│   │   ├── 👔 manager/                                (empty - future manager dashboard)
│   │   └── 💼 salesrep/                               (empty - future sales rep dashboard)
│   │
│   ├── 🔌 services/                                   ✅ 4 API SERVICES (OOP Pattern)
│   │   ├── activationService.js                       # Activation API calls
│   │   │   # Methods: validateKey, activateManager, checkKeyExists
│   │   │   # Extends: BaseService
│   │   ├── authService.js                             # Auth API calls
│   │   │   # Methods: login, register, logout, getCurrentUser
│   │   │   # Extends: BaseService
│   │   ├── BaseService.js                             # Abstract base class
│   │   │   # HTTP methods, error handling, retry logic, logging
│   │   │   # Used by: all services
│   │   └── supabaseClient.js                          # Supabase client config
│   │       # Connection, credentials, testConnection
│   │
│   ├── 🎨 styles/                                     STYLE CONSTANTS
│   │   ├── globalStyles.js                            # Global style overrides
│   │   ├── spacing.js                                 ✅ Spacing constants
│   │   │   # xs(4), sm(8), md(12), lg(16), xl(24), xxl(32)
│   │   └── typography.js                              ✅ Inter font configuration
│   │       # Font sizes, weights, families
│   │
│   ├── 📝 types/                                      (empty - TypeScript types)
│   │
│   └── 🛠️ utils/                                      ✅ 4 UTILITY FILES
│       ├── logger.js                                  # Centralized logging
│       │   # logDebug, logInfo, logWarn, logError
│       ├── storage.js                                 # AsyncStorage wrapper
│       │   # Get, set, remove, clear methods
│       ├── validationStrategies.js                    # Strategy pattern validation
│       │   # ActivationKeyStrategy, EmailStrategy, PasswordStrategy
│       └── validators.js                              # Validation helpers
│           # Required, minLength, maxLength, email, composeValidators
│
├── 📄 TO_DO_TASK.md                                   # Task tracking document
├── 📄 supabase_schema_structure(DONT_DELETE).txt      # Database schema documentation
├── 📄 context_files.txt                               ✅ KEEP - AI context guide
│   # Additional context for AI prompting
├── 📄 project_structure.txt                           ✅ KEEP - AI context guide
│   # Project structure documentation for AI
├── 📄 AGENTS.md                                       ✅ AI agent instructions
├── 📄 CLAUDE.md                                       ✅ Claude AI instructions
├── 📄 README.md                                       ✅ Project documentation
│
├── 📱 App.js                                          ✅ Main app entry
│   # Fonts loading, SafeAreaProvider, StatusBar, connection check
│
├── ⚙️ app.json                                        # Expo app configuration
├── 🔌 index.js                                        # App entry point
├── 📜 LICENSE                                         # MIT License
├── 📦 package.json                                    # Dependencies
│   # React Native, Expo, Supabase, Navigation, etc.
├── 📦 package-lock.json                               # Locked dependencies
└── 🙈 .gitignore                                      # Git ignore rules
    # node_modules, .expo, .env, etc.
```


## 📊 FILE COUNT SUMMARY

| Category | Count | Files |
|----------|-------|-------|
| **Admin CLI** | 8 | index.js, server.js, package.json, .env, supabase.js, crypto.js, web-ui/* |
| **Components (common)** | 9 | AnimatedTextDot, Button, Card, Header, Icon, Input, KeyboardWrapper, Modal, ScreenContainer |
| **Components (ui)** | 3 | Divider, LoadingSpinner, Logo |
| **Constants** | 2 | colors, roles |
| **Hooks** | 3 | useActivation, useAuth, useKeyboard |
| **Navigation** | 2 | AppNavigator, AuthStack |
| **Screens (auth)** | 2 | LoginScreen, ManagerActivationScreen |
| **Services** | 4 | activationService, authService, BaseService, supabaseClient |
| **Styles** | 3 | globalStyles, spacing, typography |
| **Utils** | 4 | logger, storage, validationStrategies, validators |
| **Root Files** | 1 | container.js |
| **Total JS Files** | **41** | ✅ All files accounted for |


## 🏗️ OOP & SOFTWARE ENGINEERING PRINCIPLES IMPLEMENTED

| Principle | Implementation | Verification |
|-----------|----------------|--------------|
| **SOLID - SRP** | Screens = UI only, Hooks = Logic, Services = API | ✅ Each file has single responsibility |
| **SOLID - OCP** | Services extend BaseService for extensibility | ✅ New services can be added without modifying existing |
| **SOLID - LSP** | All services can be swapped with mocks | ✅ Services implement same interface |
| **SOLID - ISP** | Small focused services (auth, activation) | ✅ No service has unnecessary methods |
| **SOLID - DIP** | container.js for dependency injection | ✅ Dependencies are injected, not hardcoded |
| **DRY** | Single source: colors.js, typography.js, spacing.js | ✅ No duplicate code across files |
| **KISS** | Screens < 200 lines, Hooks < 150 lines | ✅ Code is simple and readable |
| **YAGNI** | Empty folders for future features | ✅ No premature implementation |
| **Encapsulation** | Services use private methods where needed | ✅ Internal logic is hidden |
| **Inheritance** | Services extend BaseService | ✅ Shared functionality in base class |
| **Polymorphism** | Different services share common interface | ✅ All services have consistent API |
| **Composition** | Hooks compose multiple services | ✅ Services are composed not coupled |
| **Singleton** | Services are single instances | ✅ One instance per service type |
| **Factory** | container.js creates service instances | ✅ Centralized service creation |


## 🎨 AVAILABLE ICONS (10 Icons)

| Icon Name | Description | Usage Example |
|-----------|-------------|---------------|
| `warningTriangle` | Danger/warning alert | `<Icon name="warningTriangle" size={14} color="#FF0000" />` |
| `user` | Username/account | `<Icon name="user" size={20} color="#757575" />` |
| `lock` | Password/security | `<Icon name="lock" size={18} color={COLORS.textPrimary} />` |
| `lockKeyhole` | Lock with keyhole | `<Icon name="lockKeyhole" size={18} color={COLORS.textPrimary} />` |
| `eye` | Show password | `<Icon name="eye" size={20} color="#757575" />` |
| `eyeSlash` | Hide password | `<Icon name="eyeSlash" size={20} color="#757575" />` |
| `arrowLeft` | Back navigation | `<Icon name="arrowLeft" size={24} color="#FFFFFF" />` |
| `key` | Activation key | `<Icon name="key" size={24} color={COLORS.textPrimary} />` |
| `send` | Paper plane / submit | `<Icon name="send" size={20} color="#03045E" />` |
| `checkmark` | Success/verification | `<Icon name="checkmark" size={18} color={COLORS.success} />` |


## 🔒 SECURITY PRINCIPLES IMPLEMENTED

| Principle | Implementation | Status |
|-----------|----------------|--------|
| **Least Privilege** | RLS policies restrict data access | ✅ Configured |
| **Defense in Depth** | Multiple layers of validation | ✅ |
| **Input Validation** | validationStrategies.js validates all inputs | ✅ |
| **SQL Injection Prevention** | Supabase parameterized queries | ✅ |
| **Authentication** | JWT-based authentication | ✅ |
| **Authorization** | Role-based access control | ✅ |
| **Secure Storage** | AsyncStorage for tokens | ✅ |
| **CORS** | Admin CLI configured with CORS | ✅ |
| **Environment Variables** | Sensitive data in .env | ✅ |
| **Error Handling** | No sensitive info in errors | ✅ |
| **Rate Limiting** | Prevents brute force attacks | ⬜ PENDING |
| **Audit Trail** | Logs all activation attempts | ⬜ PENDING |
| **Session Management** | Token refresh, session persistence | ✅ |
| **HTTPS** | Production requires HTTPS | ⚠️ PENDING |


## 🛡️ CRITICAL WARNINGS - IMMEDIATE ATTENTION

### ⚠️ WARNING 1: RLS IS DISABLED ON activation_keys
```
🔴 SEVERITY: HIGH
📍 LOCATION: Supabase Database
📋 DESCRIPTION: Row Level Security is disabled on activation_keys table
🔧 FIX: Run ALTER TABLE activation_keys ENABLE ROW LEVEL SECURITY;
⏰ DEADLINE: Before Production Deployment
```

### ⚠️ WARNING 2: Service Role Key in .env
```
🔴 SEVERITY: HIGH
📍 LOCATION: admin-cli/.env
📋 DESCRIPTION: Service role key is exposed in development
🔧 FIX: Rotate key and use environment variables in production
⏰ DEADLINE: Before Production Deployment
```

### ⚠️ WARNING 3: Missing Rate Limiting
```
🟡 SEVERITY: MEDIUM
📍 LOCATION: admin-cli/server.js
📋 DESCRIPTION: No rate limiting on API endpoints
🔧 FIX: Add express-rate-limit middleware
⏰ DEADLINE: Before User Testing
```

### ⚠️ WARNING 4: Missing Audit Logs
```
🟡 SEVERITY: MEDIUM
📍 LOCATION: admin-cli/server.js
📋 DESCRIPTION: No tracking of key activation attempts
🔧 FIX: Add logging for all activation operations
⏰ DEADLINE: Before User Testing
```

### ⚠️ WARNING 5: Missing profiles Table
```
🔴 SEVERITY: HIGH
📍 LOCATION: Supabase Database
📋 DESCRIPTION: profiles table does not exist
🔧 FIX: Create profiles table with proper schema
⏰ DEADLINE: Before User Testing
```


## ✅ ACTION ITEMS CHECKLIST

### 🔴 PRIORITY 1 - IMMEDIATE (Before Production)

- [ ] **ENABLE RLS** on activation_keys table
- [ ] **ENABLE RLS** on profiles table
- [ ] **ROTATE** service role key
- [ ] **ADD** rate limiting to activation endpoints
- [ ] **ADD** audit logging
- [ ] **CREATE** profiles table

### 🟡 PRIORITY 2 - HIGH (Before User Testing)

- [ ] **ADD** JWT claims for role-based auth
- [ ] **IMPLEMENT** activation transaction
- [ ] **ADD** email templates
- [ ] **ADD** unit tests
- [ ] **ADD** integration tests

### 🟢 PRIORITY 3 - MEDIUM (During Development)

- [ ] **ADD** ESLint configuration
- [ ] **ADD** PropTypes validation
- [ ] **ADD** TypeScript types (optional)
- [ ] **ADD** CI/CD pipeline


## 🚀 NEXT TASKS

| Priority | Task | Status |
|----------|------|--------|
| 1 | **Manager Account Setup Screen** | ⬜ |
| 2 | **Auth/Authorization Flow** (JWT) | ⬜ |
| 3 | **Code Quality Check** (ESLint, PropTypes) | ⬜ |
| 4 | **UI Improvements** (Loading/Empty states) | ⬜ |
| 5 | **Dashboard Screen** | ⬜ |


## 📋 CODE REVIEW CHECKLIST

When submitting code for review, ensure:

- [ ] All components are reusable (not screen-specific)
- [ ] Uses container.js for dependency injection
- [ ] Extends BaseService for all services
- [ ] Uses validationStrategies.js for validation
- [ ] Uses logger.js for logging
- [ ] No hardcoded colors, spacing, or fonts
- [ ] Screens < 200 lines, Hooks < 150 lines
- [ ] PropTypes defined for all components
- [ ] Documentation comments added
- [ ] Passes all tests


## 🎯 FINAL NOTE TO ALL MEMBERS

**DO NOT IGNORE THE WARNINGS!**

This project follows strict **OOP and SOLID principles**. Any deviation must be approved by the lead developer. Always:

1. ✅ **Reuse** components before creating new ones
2. ✅ **Extend** services from BaseService
3. ✅ **Inject** dependencies via container.js
4. ✅ **Validate** using validationStrategies.js
5. ✅ **Log** using logger.js
6. ✅ **Test** all services
7. ✅ **Document** all code

**Security is not optional!** All security warnings must be addressed before production deployment.