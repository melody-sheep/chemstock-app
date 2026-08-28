// src/utils/profilePhoto.js
import { supabase } from '../services/supabaseClient';

const PROFILE_PHOTO_BUCKET = 'shipment-media';
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Resolve a single storage path to a signed URL. Degrades to null on any
 * failure so a missing/broken photo never blocks the rest of a screen.
 */
export async function resolveProfilePhotoUrl(storagePath) {
  if (!storagePath) return null;

  try {
    const { data, error } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error) {
      console.error('[ERROR] [profilePhoto] Signed URL error:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('[ERROR] [profilePhoto] Signed URL error:', error);
    return null;
  }
}

/**
 * Resolve many storage paths in one request. Returns a { [path]: url } map;
 * paths that are null/blank are skipped, and any failure degrades to an
 * empty map rather than blocking the caller's list from rendering.
 */
export async function resolveProfilePhotoUrls(storagePaths) {
  const uniquePaths = [...new Set((storagePaths || []).filter(Boolean))];
  if (uniquePaths.length === 0) return {};

  try {
    const { data, error } = await supabase.storage
      .from(PROFILE_PHOTO_BUCKET)
      .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);

    if (error) {
      console.error('[ERROR] [profilePhoto] Batch signed URL error:', error);
      return {};
    }

    const map = {};
    (data || []).forEach((entry) => {
      if (entry?.path && entry?.signedUrl) {
        map[entry.path] = entry.signedUrl;
      }
    });
    return map;
  } catch (error) {
    console.error('[ERROR] [profilePhoto] Batch signed URL error:', error);
    return {};
  }
}
