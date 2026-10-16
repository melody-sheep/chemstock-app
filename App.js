import React, { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Image, Animated, Alert, StyleSheet, Dimensions } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase, testConnection, hasStoredAuthSession } from './src/services/supabaseClient';
import authService from './src/services/authService';
import SplashLoader from './src/components/common/SplashLoader';
import { installGlobalErrorHandler } from './src/utils/logger';

installGlobalErrorHandler();

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
      }

      // Connection check runs after the splash has closed. It also tells the
      // rest of the app early whether it is offline.
      const result = await testConnection().catch((err) => ({ success: false, error: err.message }));
      if (result.success) {
        console.log('✅ [App] Supabase connection successful!');
        await testRLSPolicies();
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

    const testRLSPolicies = async () => {
      try {
        // Test reading from activation_keys
        const { data, error } = await supabase
          .from('activation_keys')
          .select('id, code')
          .limit(1);
        
        if (error) {
          console.warn('⚠️ [App] RLS policy check - read failed:', error.message);
          if (__DEV__) {
            Alert.alert(
              'RLS Warning',
              'Row Level Security is enabled. Some operations may fail.\n\nThis is normal in development with RLS enabled.',
              [{ text: 'OK' }]
            );
          }
        } else {
          console.log('✅ [App] RLS read successful');
          console.log('📊 Sample data:', data);
        }
      } catch (err) {
        console.warn('⚠️ [App] RLS test error:', err.message);
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