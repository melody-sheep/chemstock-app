// App.js
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { supabase, testConnection } from './src/services/supabaseClient';

export default function App() {
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    const checkConnection = async () => {
      console.log('🔌 Testing Supabase connection...');
      
      try {
        // ✅ FIX: Use 'activation_keys' (your data is here!)
        const { data, error } = await supabase
          .from('activation_keys')  // ← CORRECT TABLE NAME
          .select('id, code')
          .limit(1);
        
        if (error) {
          console.error('❌ Connection error:', error.message);
          setConnectionError(error.message);
          
          if (__DEV__) {
            Alert.alert(
              'Connection Issue',
              `Cannot connect to database:\n${error.message}\n\nCheck your internet and Supabase credentials.`
            );
          }
        } else {
          console.log('✅ Supabase connected successfully!');
          console.log('📊 Sample data:', data);
        }
      } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        setConnectionError(err.message);
      } finally {
        setIsConnecting(false);
      }
    };
    
    checkConnection();
  }, []);

  if (isConnecting) {
    return (
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4c9f70" />
          <Text style={{ marginTop: 20, color: '#666' }}>Connecting to server...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}