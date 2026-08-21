// src/navigation/AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import ManagerActivationScreen from '../screens/auth/ManagerActivationScreen';
import ManagerDashboardScreen from '../screens/manager/ManagerDashboardScreen';
import ManageAccountsScreen from '../screens/manager/ManageAccountsScreen';
import AgentAccountsScreen from '../screens/manager/AgentAccountsScreen';
import ReceiveStockScreen from '../screens/manager/ReceiveStockScreen';
import AddNewBatchesScreen from '../screens/manager/AddNewBatchesScreen';
import ReceiveStockPreviewScreen from '../screens/manager/ReceiveStockPreviewScreen';
import ManagerStockScreen from '../screens/manager/ManagerStockScreen';
import StockLogsScreen from '../screens/manager/StockLogsScreen';
import ReleaseStockRecipientScreen from '../screens/manager/ReleaseStockRecipientScreen';
import ReleaseStockMethodScreen from '../screens/manager/ReleaseStockMethodScreen';
import ReleaseStockScanReviewScreen from '../screens/manager/ReleaseStockScanReviewScreen';
import QuickRegisterReleaseScreen from '../screens/manager/QuickRegisterReleaseScreen';
import ReleaseStockConfirmScreen from '../screens/manager/ReleaseStockConfirmScreen';
import ManageReturnsScreen from '../screens/manager/ManageReturnsScreen';
import ReturnStockVerifyScreen from '../screens/manager/ReturnStockVerifyScreen';
import ManagerAlertsScreen from '../screens/manager/ManagerAlertsScreen';
import SalesRepDashboardScreen from '../screens/salesrep/SalesRepDashboardScreen';
import ReceiveStockTypeSR from '../screens/salesrep/ReceiveStockTypeSR';
import ReceiveStockSR from '../screens/salesrep/ReceiveStockSR';
import RequestStockSR from '../screens/salesrep/RequestStockSR';
import SubmitReportSR from '../screens/salesrep/SubmitReportSR';
import AlertsDiscrepanciesSR from '../screens/salesrep/AlertsDiscrepanciesSR';
import ReturnStocksSR from '../screens/salesrep/ReturnStocksSR';
import SalesRepStockScreen from '../screens/salesrep/SalesRepStockScreen';
import SalesRepReportsScreen from '../screens/salesrep/SalesRepReportsScreen';
import SalesRepSettingsScreen from '../screens/salesrep/SalesRepSettingsScreen';
import CollectorDashboardScreen from '../screens/collector/CollectorDashboardScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ManagerActivation" component={ManagerActivationScreen} />
        <Stack.Screen name="ManagerDashboard" component={ManagerDashboardScreen} />
        <Stack.Screen name="ManageAccounts" component={ManageAccountsScreen} />
        <Stack.Screen name="AgentAccounts" component={AgentAccountsScreen} />
        <Stack.Screen name="ReceiveStock" component={ReceiveStockScreen} />
        <Stack.Screen name="AddNewBatches" component={AddNewBatchesScreen} />
        <Stack.Screen name="ReceiveStockPreview" component={ReceiveStockPreviewScreen} />
        <Stack.Screen name="ManagerStock" component={ManagerStockScreen} />
        <Stack.Screen name="StockLogs" component={StockLogsScreen} />
        <Stack.Screen name="ReleaseStockRecipient" component={ReleaseStockRecipientScreen} />
        <Stack.Screen name="ReleaseStockMethod" component={ReleaseStockMethodScreen} />
        <Stack.Screen name="ReleaseStockScanReview" component={ReleaseStockScanReviewScreen} />
        <Stack.Screen name="QuickRegisterRelease" component={QuickRegisterReleaseScreen} />
        <Stack.Screen name="ReleaseStockConfirm" component={ReleaseStockConfirmScreen} />
        <Stack.Screen name="ManageReturns" component={ManageReturnsScreen} />
        <Stack.Screen name="ReturnStockVerify" component={ReturnStockVerifyScreen} />
        <Stack.Screen name="ManagerAlerts" component={ManagerAlertsScreen} />
        <Stack.Screen name="SalesRepDashboard" component={SalesRepDashboardScreen} />
        <Stack.Screen name="ReceiveStockTypeSR" component={ReceiveStockTypeSR} />
        <Stack.Screen name="ReceiveStockSR" component={ReceiveStockSR} />
        <Stack.Screen name="RequestStockSR" component={RequestStockSR} />
        <Stack.Screen name="SubmitReportSR" component={SubmitReportSR} />
        <Stack.Screen name="AlertsDiscrepanciesSR" component={AlertsDiscrepanciesSR} />
        <Stack.Screen name="ReturnStocksSR" component={ReturnStocksSR} />
        <Stack.Screen name="SalesRepStock" component={SalesRepStockScreen} />
        <Stack.Screen name="SalesRepReports" component={SalesRepReportsScreen} />
        <Stack.Screen name="SalesRepSettings" component={SalesRepSettingsScreen} />
        <Stack.Screen name="CollectorDashboard" component={CollectorDashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
