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

export const getDeviceOs = () => [Device.osName, Device.osVersion].filter(Boolean).join(' ');
