import React, { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image, Animated, Alert, StyleSheet, Dimensions, AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase, testConnection, hasStoredAuthSession } from './src/services/supabaseClient';
import authService from './src/services/authService';
import { installNotificationHandler } from './src/services/pushService';
import { getConnectionStatus } from './src/services/connectionStatus';
import SplashLoader from './src/components/common/SplashLoader';
import PermissionsPrompt from './src/components/common/PermissionsPrompt';
import AppAlertHost from './src/components/common/AppAlertHost';
import { installGlobalErrorHandler, installConsoleErrorFormatter, debugLog } from './src/utils/logger';
installGlobalErrorHandler();
installConsoleErrorFormatter();
installNotificationHandler();

const appStartedAt = Date.now();

// One line describing the phone and build, so a pasted log or Share Debug Log
// says which Android version / model / APK build it came from.
debugLog('info', 'Launch', 'device', {
  app: Constants.expoConfig?.version ?? null,
  build: Constants.expoConfig?.android?.versionCode ?? null,
  // 'storeClient' is Expo Go or a development build; 'standalone' is a release APK.
  runtime: Constants.executionEnvironment === 'standalone' ? 'release APK' : 'Expo Go / dev build',
  android: Device.osVersion,
  apiLevel: Platform.Version,
  model: Device.modelName,
  brand: Device.brand,
});

const formatDuration = (ms) => {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return `${Math.round(ms / 1000)}s`;
  const hours = Math.floor(totalMinutes / 60);
  return hours > 0 ? `${hours}h ${totalMinutes % 60}m` : `${totalMinutes}m`;
};

// Where each role lands when a persisted session is found on launch. The
// session itself was already being persisted (authService.js's
// AGENT_SESSION_KEY, supabaseClient.js's persistSession) — nothing ever
// read it back on app start, so every restart forced a fresh login even
// with a valid session sitting in storage. This is the fix for that.
const DASHBOARD_ROUTE_BY_ROLE = {
  manager: 'ManagerDashboard',
  sales_rep: 'SalesRepDashboard',
  collector: 'CollectorDashboard',
};

// Cap for the one launch path that still needs the network: a manager login
// saved on the phone with no saved profile yet.
const SESSION_RESTORE_TIMEOUT_MS = 10000;

const withTimeout = (promise, ms, fallbackValue) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);

// How long the logo splash holds once the app is actually ready, so a fast
// connection doesn't flash the logo by in a single frame — and how long the
// fade-out itself takes.
const SPLASH_MIN_HOLD_MS = 250;
const SPLASH_FADE_MS = 400;

export default function App() {
  const [isConnecting, setIsConnecting] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState(null);
  const [isSplashMounted, setIsSplashMounted] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  // Crossfades the logo splash out once the app underneath is ready, instead
  // of abruptly swapping the "Connecting to server..." view for the
  // navigator. The navigator mounts underneath while the splash is still
  // fully opaque, so there's nothing to flash past it.
  useEffect(() => {
    if (isConnecting) return;
    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: SPLASH_FADE_MS,
        useNativeDriver: true,
      }).start(() => setIsSplashMounted(false));
    }, SPLASH_MIN_HOLD_MS);
    return () => clearTimeout(timer);
  }, [isConnecting]);

  // Logs going to the background and coming back, with how long it was away —
  // the long-idle logout problems all start with "the app was away for hours".
  useEffect(() => {
    let current = AppState.currentState;
    let changedAt = Date.now();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === current) return;
      debugLog('info', 'App', `${current} → ${next} after ${formatDuration(Date.now() - changedAt)}`, {
        online: getConnectionStatus().online,
      });
      current = next;
      changedAt = Date.now();
      // The step supabase-js documents for React Native: refresh the Manager's login only while the app is
      // open. Without it a timer left over from before the pause can fire together with the refresh on
      // return, and two refreshes of one login make the server end it ("session expired").
      if (next === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 [App] Initializing application...');
      console.log('📱 [App] Environment:', __DEV__ ? 'Development' : 'Production');

      // Only the session restore holds the splash. It reads the phone first,
      // so launch no longer waits on the network at all when a login is saved.
      let restoredRouteName = null;
      try {
        restoredRouteName = await resolveExistingSession();
      } finally {
        setIsConnecting(false);
        debugLog('info', 'Launch', `ready in ${Date.now() - appStartedAt}ms → ${restoredRouteName || 'Login'}`, {
          from: restoredRouteName ? 'login saved on phone' : 'no saved login',
        });
      }

      // Connection check runs after the splash has closed. It also tells the
      // rest of the app early whether it is offline.
      const result = await testConnection().catch((err) => ({ success: false, error: err.message }));
      if (result.success) {
        console.log('✅ [App] Supabase connection successful!');
      } else if (restoredRouteName) {
        console.log('ℹ️ [App] Connection probe failed but a session was restored — continuing offline, not surfacing the error.');
      } else {
        console.error('❌ [App] Connection failed:', result.error);
        if (__DEV__) {
          Alert.alert(
            'Connection Issue',
            `Cannot connect to database:\n${result.error}\n\nPlease check:\n1. Internet connection\n2. Supabase credentials\n3. Table permissions`
          );
        }
      }
    };

    // The login saved on the phone decides the first screen, with no network
    // call. Screens refresh the profile online on their own once open.
    const getLaunchUser = async () => {
      const savedUser = await authService.getSavedUser();
      if (savedUser?.role === 'sales_rep' || savedUser?.role === 'collector') return savedUser;
      if (await hasStoredAuthSession()) {
        if (savedUser) return savedUser;
        // A manager login with no saved profile yet: the old, network-based
        // restore, capped so it can't hold the splash for long.
        const user = await withTimeout(authService.getCurrentUser(), SESSION_RESTORE_TIMEOUT_MS, null);
        return user;
      }
      return null;
    };

    const resolveExistingSession = async () => {
      try {
        const user = await getLaunchUser();
        const routeName = user?.role ? DASHBOARD_ROUTE_BY_ROLE[user.role] : null;
        if (routeName) {
          console.log('✅ [App] Existing session found, skipping Login:', user.role);
          setInitialRouteName(routeName);
        }
        return routeName;
      } catch (err) {
        console.warn('⚠️ [App] No existing session to restore:', err.message);
        return null;
      }
    };

    initializeApp();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isSplashMounted ? 'dark' : 'auto'} />

        {!isConnecting && (
          <AppNavigator initialRouteName={initialRouteName || 'Login'} />
        )}

        {/* First launch after a fresh install: ask for location + camera once. */}
        {!isConnecting && <PermissionsPrompt />}

        {/* Every message in the app (was the grey system popup) is drawn here. */}
        <AppAlertHost />

        {isSplashMounted && (
          <Animated.View
            style={[styles.splash, { opacity: splashOpacity }]}
            pointerEvents={isConnecting ? 'auto' : 'none'}
          >
            <Image
              source={require('./assets/ChemStockLogo.png')}
              style={styles.splashLogo}
              resizeMode="contain"
            />
            {/* Absolute so the logo stays exactly centred */}
            <SplashLoader style={styles.splashLoader} />
          </Animated.View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Explicit window dimensions instead of StyleSheet.absoluteFillObject
// (top/left/right/bottom: 0) — the splash is the very first thing painted
// on cold launch, before SafeAreaProvider/GestureHandlerRootView have
// necessarily completed their own first layout pass. Anchoring via
// right/bottom depends on the parent already being measured; Dimensions is
// resolved synchronously and isn't subject to that race, so the overlay
// can't render at a stale/partial size on that very first frame.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  splash: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 999,
  },
  splashLogo: {
    width: 180,
    height: 180,
  },
  splashLoader: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 + 110,
    left: 0,
    width: SCREEN_WIDTH,
  },
});