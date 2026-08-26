// src/utils/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin AsyncStorage wrapper with JSON serialization. Used to persist agent
 * (Sales Rep/Collector) sessions, which don't get a real Supabase Auth
 * session — see authService's agent login path.
 */
export const storage = {
  async get(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[ERROR] [storage] Failed to get "${key}":`, error.message);
      return null;
    }
  },

  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`[ERROR] [storage] Failed to set "${key}":`, error.message);
    }
  },

  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[ERROR] [storage] Failed to remove "${key}":`, error.message);
    }
  },
};

export default storage;
