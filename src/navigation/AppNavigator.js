// src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import ManagerActivationScreen from '../screens/auth/ManagerActivationScreen';
import ManagerDashboardScreen from '../screens/manager/ManagerDashboardScreen';
import AgentAccountsScreen from '../screens/manager/AgentAccountsScreen';
import ReceiveStockScreen from '../screens/manager/ReceiveStockScreen';
import AddNewBatchesScreen from '../screens/manager/AddNewBatchesScreen';
import SalesRepDashboardScreen from '../screens/salesrep/SalesRepDashboardScreen';
import CollectorDashboardScreen from '../screens/collector/CollectorDashboardScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ManagerActivation" component={ManagerActivationScreen} />
        <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
        <Stack.Screen name="AgentAccounts" component={AgentAccountsScreen} />
        <Stack.Screen name="ReceiveStock" component={ReceiveStockScreen} />
        <Stack.Screen name="AddNewBatches" component={AddNewBatchesScreen} />
        <Stack.Screen name="SalesRepDashboard" component={SalesRepDashboardScreen} />
        <Stack.Screen name="CollectorDashboard" component={CollectorDashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
