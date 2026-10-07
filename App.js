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

export default function App() {
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [initialRouteName, setInitialRouteName] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 [App] Initializing application...');
      console.log('📱 [App] Environment:', __DEV__ ? 'Development' : 'Production');
      
      try {
        // Test connection
        const result = await testConnection();
        
        if (result.success) {
          console.log('✅ [App] Supabase connection successful!');
          setConnectionStatus('Connected');
          
          // Test RLS policies on activation_keys only
          await testRLSPolicies();
        } else {
          console.error('❌ [App] Connection failed:', result.error);
          setConnectionError(result.error);
          
          if (__DEV__) {
            Alert.alert(
              'Connection Issue',
              `Cannot connect to database:\n${result.error}\n\nPlease check:\n1. Internet connection\n2. Supabase credentials\n3. Table permissions`
            );
          }
        }
      } catch (err) {
        console.error('❌ [App] Unexpected error:', err.message);
        setConnectionError(err.message);
      } finally {
        // Check for an already-logged-in session regardless of how the
        // connection test above went — restoring a Manager's Supabase
        // session or a cached agent session both read from local storage,
        // no live request required.
        await resolveExistingSession();
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
      } catch (err) {
        console.warn('⚠️ [App] No existing session to restore:', err.message);
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