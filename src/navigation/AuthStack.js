// src/navigation/AuthStack.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import ManagerActivationScreen from '../screens/auth/ManagerActivationScreen';

const Stack = createNativeStackNavigator();

/**
 * Authentication Stack Navigator
 * Handles unauthenticated flow: Login → Activation → Dashboard
 */
export default function AuthStack() {
  console.log('========================================');
  console.log('🧭 [AuthStack] ======================================');
  console.log('🧭 [AuthStack] AuthStack rendered');
  console.log('========================================');

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: '#F8FAFC',
        },
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{
          title: 'Login',
        }}
      />
      
      <Stack.Screen 
        name="ManagerActivation" 
        component={ManagerActivationScreen}
        options={{
          title: 'Manager Activation',
        }}
      />
    </Stack.Navigator>
  );
}