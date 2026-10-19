// src/utils/keyboardDebug.js
// Temporary diagnostic for the APK keyboard problem (Oct 20). Logs what
// Android reports when the keyboard opens/closes and when a popup opens, so
// Settings → Share Debug Log shows whether a popup's text field ever produces
// a "keyboard shown" line. Remove once the keyboard fix is confirmed.
import { Dimensions, Keyboard } from 'react-native';
import { debugLog } from './logger';

let installed = false;

export function installKeyboardDebug() {
  if (installed) return;
  installed = true;
  const sizes = () => {
    const w = Dimensions.get('window');
    const s = Dimensions.get('screen');
    return { windowH: Math.round(w.height), screenH: Math.round(s.height) };
  };
  Keyboard.addListener('keyboardDidShow', (e) => {
    const c = e?.endCoordinates || {};
    debugLog('info', 'Keyboard', 'shown', {
      top: Math.round(c.screenY ?? -1),
      height: Math.round(c.height ?? -1),
      ...sizes(),
    });
  });
  Keyboard.addListener('keyboardDidHide', () => {
    debugLog('info', 'Keyboard', 'hidden', sizes());
  });
}

/** One line per popup opened, so the log shows which popup was in front. */
export function logPopupOpened(name) {
  debugLog('info', 'Keyboard', `popup opened: ${name || 'sheet'}`, {});
}

/** What a screen measured and applied: its bottom edge vs the keyboard top. */
export function logKeyboardMeasure(where, data) {
  debugLog('info', 'Keyboard', `measured ${where}`, data);
}
