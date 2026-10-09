import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase, testConnection, getFriendlyErrorMessage } from './src/services/supabaseClient';
import authService from './src/services/authService';
import { COLORS } from './src/constants/colors';
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

// Offline, a network call can take a while to actually fail rather than
// erroring instantly — without a cap, "Connecting to server..." could sit on
// screen far longer than it should before falling back. Caps the connection
// probe only; session restore (see below) runs independently of it.
const CONNECTION_PROBE_TIMEOUT_MS = 6000;

const withTimeout = (promise, ms, fallbackValue) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), ms)),
  ]);

export default function App() {
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [initialRouteName, setInitialRouteName] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 [App] Initializing application...');
      console.log('📱 [App] Environment:', __DEV__ ? 'Development' : 'Production');

      // Run the connection probe and session restore in parallel — restoring
      // a session (Supabase session + cached profile, or a cached agent
      // session) reads from local storage and must not sit behind a slow or
      // hanging network probe that has nothing to do with it.
      const [result, restoredRouteName] = await Promise.all([
        withTimeout(testConnection(), CONNECTION_PROBE_TIMEOUT_MS, {
          success: false,
          error: 'Connection timed out',
        }).catch((err) => ({ success: false, error: err.message })),
        resolveExistingSession(),
      ]);

      try {
        if (result.success) {
          console.log('✅ [App] Supabase connection successful!');
          setConnectionStatus('Connected');

          // Test RLS policies on activation_keys only
          await testRLSPolicies();
        } else {
          console.error('❌ [App] Connection failed:', result.error);

          // A failed probe is expected and already handled gracefully when a
          // session was restored above (offline + cached profile/agent
          // session) — only surface this as an error when there's truly
          // nothing to fall back on, otherwise a dev build alerts and blocks
          // the screen on every normal offline launch for a user who's
          // actually fine.
          if (!restoredRouteName) {
            setConnectionError(result.error);

            if (__DEV__) {
              Alert.alert(
                'Connection Issue',
                `Cannot connect to database:\n${result.error}\n\nPlease check:\n1. Internet connection\n2. Supabase credentials\n3. Table permissions`
              );
            }
          } else {
            console.log('ℹ️ [App] Connection probe failed but a session was restored — continuing offline, not surfacing the error.');
          }
        }
      } catch (err) {
        console.error('❌ [App] Unexpected error:', err.message);
        setConnectionError(err.message);
      } finally {
        setIsConnecting(false);
      }
    };

    const resolveExistingSession = async () => {
      try {
        const user = await authService.getCurrentUser();
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

  if (isConnecting) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: COLORS.background
        }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ 
            marginTop: 20, 
            color: COLORS.textSecondary,
            fontSize: 16
          }}>
            {connectionStatus || 'Connecting to server...'}
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (connectionError && __DEV__) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: 20,
          backgroundColor: COLORS.background
        }}>
          <Text style={{ 
            color: COLORS.error, 
            fontSize: 18,
            fontWeight: 'bold',
            marginBottom: 10
          }}>
            Connection Error
          </Text>
          <Text style={{ 
            color: COLORS.textSecondary, 
            textAlign: 'center',
            marginBottom: 20
          }}>
            {connectionError}
          </Text>
          <Text style={{ 
            color: COLORS.textSecondary, 
            fontSize: 12,
            textAlign: 'center'
          }}>
            Check your internet connection and Supabase credentials.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator initialRouteName={initialRouteName || 'Login'} />
    </SafeAreaProvider>
  );
}