// src/utils/deviceInfo.js
import * as Device from 'expo-device';

// Device info needs no runtime permission; expo-device reads it directly.
export const getDeviceModel = () => {
  const brand = Device.brand?.trim();
  const model = Device.modelName?.trim();
  if (!model) return brand || 'Unknown device';
  if (!brand || model.toLowerCase().startsWith(brand.toLowerCase())) return model;
  return `${brand} ${model}`;
};

// Some phones (e.g. Infinix) report the whole build fingerprint as osName
// ("Infinix/X6731-GL/…:user/release-keys"); show "Android 14" instead.
const cleanOsName = () => {
  const name = Device.osName?.trim();
  if (!name || name.includes('/') || name.length > 20) return Device.platformApiLevel != null || !name ? 'Android' : name;
  return name;
};

export const getDeviceOs = () => [cleanOsName(), Device.osVersion].filter(Boolean).join(' ');

/**
 * What screens show for "which phone": "Infinix X6731 · Rhaenyra" (who used
 * it), else "Infinix X6731 · Android 14". The person is never stored inside
 * the device field — who did it is already saved on its own.
 */
export const getDeviceLabel = (personName) => `${getDeviceModel()} · ${personName || getDeviceOs()}`;

/**
 * Older records saved the whole build fingerprint as the OS
 * ("Infinix/X6731-GL/…:user/release-keys 14"). For display, keep just "Android 14".
 */
export const cleanDeviceOs = (os) => {
  if (!os) return '';
  const text = String(os).trim();
  if (!text.includes('/')) return text;
  const last = text.split(/\s+/).pop();
  return /^\d+(\.\d+)*$/.test(last) ? `Android ${last}` : 'Android';
};
