// src/utils/appAlert.js
// Drop-in replacement for React Native's Alert: the same Alert.alert(title,
// message, buttons) call, but shown as ChemStock's own dialog instead of the
// grey system popup, so every message in the app looks the same.
//
//   import Alert from '../../utils/appAlert';
//   Alert.alert('Saved', 'Your changes were saved.');
//   Alert.alert('Delete?', 'This cannot be undone.', [
//     { text: 'Cancel', style: 'cancel' },
//     { text: 'Delete', style: 'destructive', onPress: remove },
//   ]);
//
// Shown by <AppAlertHost /> (mounted once in App.js). Before that mounts
// (or if it ever isn't there) it falls back to the system popup.
import { Alert as NativeAlert } from 'react-native';

let listener = null;
let nextId = 1;
const pending = [];

const notify = () => {
  if (listener) listener([...pending]);
};

export function subscribeAppAlerts(fn) {
  listener = fn;
  fn([...pending]);
  return () => {
    if (listener === fn) listener = null;
  };
}

export function dismissAppAlert(id) {
  const index = pending.findIndex((a) => a.id === id);
  if (index >= 0) pending.splice(index, 1);
  notify();
}

const alert = (title, message, buttons, options) => {
  // No host on screen: use the system popup rather than lose the message.
  if (!listener) {
    NativeAlert.alert(title, message, buttons, options);
    return;
  }
  const actions = Array.isArray(buttons) && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  pending.push({
    id: nextId++,
    title: title == null ? '' : String(title),
    message: message == null ? '' : String(message),
    buttons: actions,
    cancelable: options?.cancelable !== false,
    onDismiss: options?.onDismiss,
  });
  notify();
};

const AppAlert = { alert };
export default AppAlert;
