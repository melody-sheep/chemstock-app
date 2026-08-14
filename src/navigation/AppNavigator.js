// src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import ManagerActivationScreen from '../screens/auth/ManagerActivationScreen';
import ManagerDashboardScreen from '../screens/manager/ManagerDashboardScreen';
<<<<<<< Updated upstream
=======
import AgentAccountsScreen from '../screens/manager/AgentAccountsScreen';
import SalesRepDashboardScreen from '../screens/salesrep/SalesRepDashboardScreen';
import CollectorDashboardScreen from '../screens/collector/CollectorDashboardScreen';
>>>>>>> Stashed changes

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ManagerActivation" component={ManagerActivationScreen} />
<<<<<<< Updated upstream
        <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} /> 
=======
        <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
        <Stack.Screen name="AgentAccounts" component={AgentAccountsScreen} />
        <Stack.Screen name="SalesRepDashboard" component={SalesRepDashboardScreen} />
        <Stack.Screen name="CollectorDashboard" component={CollectorDashboardScreen} />
>>>>>>> Stashed changes
      </Stack.Navigator>
    </NavigationContainer>
  );
}
