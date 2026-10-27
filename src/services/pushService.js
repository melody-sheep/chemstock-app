// src/services/pushService.js
// Push notifications: registers this phone's Expo push token for the signed-in user, so the database can send a
// push whenever a notification row is created. Everything here is best effort: a failure only logs, and never
// breaks login or any screen. Remote push needs a real APK (Expo Go cannot receive it).
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from './supabaseClient';
import { getConnectionStatus } from './connectionStatus';
import storage from '../utils/storage';
import { debugLog } from '../utils/logger';

const CHANNEL_ID = 'default';
const TOKEN_KEY = 'chemstock_push_token';
const ASKED_KEY = 'chemstock_push_permission_asked';
const PENDING_UNREGISTER_KEY = 'chemstock_push_unregister_pending';
const LAST_TAP_KEY = 'chemstock_push_last_tap';

// expo-notifications is loaded only where push can work. In Expo Go it only prints warnings, so it is never
// imported there.
let notificationsModule = null;
const getNotifications = () => {
  if (!notificationsModule) notificationsModule = require('expo-notifications');
  return notificationsModule;
};

let registeredFor = null;
let busy = false;

/** What to do with a push that arrives while the app is open: show it as a banner, like the system does. */
export function installNotificationHandler() {
  if (!canUsePush()) return;
  getNotifications().setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const canUsePush = () => Platform.OS === 'android' && Device.isDevice && Constants.appOwnership !== 'expo';

async function ensureChannel() {
  const Notifications = getNotifications();
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'ChemStock',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 200, 150, 200],
    lightColor: '#03045E',
  });
}

// Asks once; after that the phone's own settings decide (Settings > Apps > ChemStock > Notifications).
async function hasPermission() {
  const Notifications = getNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain || (await storage.get(ASKED_KEY))) return false;
  await storage.set(ASKED_KEY, true);
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

// A logout that could not reach the server (offline) is finished the next time this runs.
async function flushPendingUnregister() {
  const pending = await storage.get(PENDING_UNREGISTER_KEY);
  if (!pending || !getConnectionStatus().online) return;
  const { error } = await supabase.rpc('unregister_push_token', { p_token: pending });
  if (!error) await storage.remove(PENDING_UNREGISTER_KEY);
}

/**
 * Called with the signed-in user (a Manager with a Supabase login, or a Sales Rep / Collector).
 * Does the work once per app run and user; if anything is missing (offline, permission, token) it tries
 * again the next time the current user is loaded.
 */
export async function syncPushRegistration(user) {
  if (!user?.id || busy || registeredFor === user.id || !canUsePush()) return;
  if (!getConnectionStatus().online) return;
  busy = true;
  try {
    await flushPendingUnregister();
    await ensureChannel();
    if (!(await hasPermission())) {
      debugLog('info', 'Push', 'Notifications are not allowed on this phone, nothing registered');
      return;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await getNotifications().getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      // Sales Reps and Collectors have no Supabase login; their id is sent instead.
      p_agent_id: user.role === 'manager' ? null : user.id,
      p_device_model: Device.modelName || null,
    });
    if (error) {
      debugLog('warn', 'Push', 'Could not register the push token', { message: error.message });
      return;
    }
    await storage.set(TOKEN_KEY, token);
    registeredFor = user.id;
    debugLog('info', 'Push', 'Push token registered');
  } catch (error) {
    debugLog('warn', 'Push', 'Push registration failed', { message: error?.message });
  } finally {
    busy = false;
  }
}

/** On logout: stop sending this phone the previous user's notifications. */
export async function unregisterPush() {
  registeredFor = null;
  if (!canUsePush()) return;
  try {
    const token = await storage.get(TOKEN_KEY);
    if (!token) return;
    await storage.remove(TOKEN_KEY);
    if (!getConnectionStatus().online) {
      await storage.set(PENDING_UNREGISTER_KEY, token);
      return;
    }
    const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
    if (error) await storage.set(PENDING_UNREGISTER_KEY, token);
  } catch (error) {
    debugLog('warn', 'Push', 'Could not unregister the push token', { message: error?.message });
  }
}

/** Calls onOpen when a push is tapped, whether the app was closed, in the background or open. */
export function listenForPushTaps(onOpen) {
  if (!canUsePush()) return () => {};
  const Notifications = getNotifications();
  // The phone can hand back the same tap again (the last response stays available), so each push is handled once.
  const handle = async (response) => {
    const id = response?.notification?.request?.identifier;
    if (!id) return;
    if ((await storage.get(LAST_TAP_KEY)) === id) return;
    await storage.set(LAST_TAP_KEY, id);
    onOpen();
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync()
    .then(handle)
    .catch(() => {});
  return () => subscription.remove();
}
