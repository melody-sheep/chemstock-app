// src/utils/exportFolder.js
// Saves a generated report (PDF / Excel) straight into a folder on the phone.
//
// The share sheet only hands a file to another app; it has no "Save to device"
// choice, so on Android nothing ended up in Downloads. Android's folder picker
// (Storage Access Framework) lets the user pick one folder once; ChemStock
// remembers it and every later export is written there without asking again.
//
// Android 11+ won't let an app pick the root of Downloads, so the picker
// starts in Downloads and the user makes or picks a sub-folder (e.g. ChemStock).
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import storage from './storage';

const FOLDER_KEY = 'chemstock_export_folder_uri';

/** Saving into a chosen folder is an Android feature; elsewhere the share sheet offers "Save to Files". */
export const canSaveToFolder = Platform.OS === 'android';

/** "content://…/tree/primary%3ADownload%2FChemStock" → "Download/ChemStock" */
export function folderLabel(uri) {
  if (!uri) return '';
  try {
    const tree = String(uri).split('/tree/')[1] || '';
    const decoded = decodeURIComponent(tree);
    const path = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : decoded;
    return path || 'Selected folder';
  } catch {
    return 'Selected folder';
  }
}

export async function getSavedFolder() {
  return storage.get(FOLDER_KEY);
}

export async function forgetSavedFolder() {
  await storage.remove(FOLDER_KEY);
}

/** Opens Android's folder picker (starting in Downloads). Returns the folder's uri, or null if cancelled. */
export async function pickExportFolder() {
  const SAF = FileSystem.StorageAccessFramework;
  let initialUri = null;
  try {
    initialUri = SAF.getUriForDirectoryInRoot('Download');
  } catch {
    initialUri = null; // the picker just opens at its default place
  }
  const result = await SAF.requestDirectoryPermissionsAsync(initialUri);
  if (!result.granted) return null;
  await storage.set(FOLDER_KEY, result.directoryUri);
  return result.directoryUri;
}

/** Writes a base64 file into the folder. Throws if the folder is gone or no longer permitted. */
export async function saveBase64ToFolder({ folderUri, fileName, mimeType, base64 }) {
  const SAF = FileSystem.StorageAccessFramework;
  const fileUri = await SAF.createFileAsync(folderUri, fileName, mimeType);
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return fileUri;
}
