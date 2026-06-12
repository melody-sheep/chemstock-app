# 🧪 ChemStock Mobile App

**Status:** 🚧 Under Active Development  
**Target Release:** 📅 October 2026

## 📱 About
ChemStock is a mobile inventory management system for chemical supply chain and custody tracking.

## 🎯 Current Status (Pre-Release)
- ✅ Login screen UI foundation complete
- ✅ **AnimatedTextDot component with typing animation** 🆕
- ✅ **Smooth color cycling background (5 colors)** 🆕
- ✅ **Dynamic typing speed based on text length** 🆕
- ✅ **Fade in/out text animation with reverse typing** 🆕
- ✅ Interactive floating particle animations
- ✅ Reusable component architecture established
- ⏳ Authentication integration (in progress)
- ⏳ Dashboard screens (pending)
- ⏳ Inventory management features (pending)

## 🚀 Release Timeline
**October 2026** - Full production release

## 🛠️ Tech Stack
- React Native / Expo
- React Native Animated API
- Phosphor Icons
- Supabase (Backend)
- React Navigation

## 📁 Project Structure
Follows strict software engineering principles:
- Reusable components in `src/components/common/` (includes new `AnimatedTextDot.js`)
- Single source of truth in `src/constants/`
- No hardcoded values - uses centralized colors, typography, spacing

## 🎬 Animation Features
- **Typing Animation:** Text appears character by character
- **Reverse Animation:** Text disappears character by character (faster)
- **Color Cycling:** Background smoothly transitions through 5 vibrant colors
- **Dynamic Speed:** Longer phrases type faster for consistent timing
- **Auto Loop:** Animation cycles through all phrases infinitely

## ⚠️ Development Rules
- NEVER delete `src/constants/colors.js`, `src/styles/typography.js`, `src/styles/spacing.js`
- ALWAYS import from constants, never hardcode values
- Use reusable Button and Modal components from `src/components/common/`
- Use reusable AnimatedTextDot component for consistent animations

## 👥 Team
Internal use only - authorized personnel

---
**© 2026 ChemStock - Securing the Chain of Custody**