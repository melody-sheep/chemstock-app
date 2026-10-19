// src/utils/offlinePhoto.js
// Profile photos are signed storage URLs: offline they can't be fetched, so
// map markers fell back to blank avatars. Each photo seen online is kept as
// a small file on the phone, keyed by user id, and handed back offline as a
// data URI (the map runs in a WebView, which can't read app file paths).
import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { getConnectionStatus } from '../services/connectionStatus';

const DIR = `${FileSystem.cacheDirectory}avatars/`;
const fileFor = (userId) => `${DIR}${String(userId).replace(/[^a-zA-Z0-9-]/g, '')}.jpg`;

/** Saves the photo behind `remoteUrl` for `userId` (online, in the background). */
export async function rememberPhoto(userId, remoteUrl) {
  if (!userId || !remoteUrl || !getConnectionStatus().online) return;
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    await FileSystem.downloadAsync(remoteUrl, fileFor(userId));
  } catch (error) {
    // Best effort — the online URL still works while online.
  }
}

/** The saved photo for `userId` as a data URI, or null if none was saved. */
export async function savedPhotoDataUri(userId) {
  if (!userId) return null;
  try {
    const path = fileFor(userId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const base64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    return null;
  }
}

/** Online: the live URL (and saves it). Offline: the saved copy, or null. */
export async function photoForMap(userId, remoteUrl) {
  if (getConnectionStatus().online && remoteUrl) {
    rememberPhoto(userId, remoteUrl);
    return remoteUrl;
  }
  return savedPhotoDataUri(userId);
}

/** Hook form of photoForMap for a screen's own user. */
export function useMapPhoto(userId, remoteUrl) {
  const [uri, setUri] = useState(remoteUrl || null);
  useEffect(() => {
    let active = true;
    photoForMap(userId, remoteUrl).then((next) => {
      if (active) setUri(next);
    });
    return () => {
      active = false;
    };
  }, [userId, remoteUrl]);
  return uri;
}
