// src/services/inventoryService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';

const SHIPMENT_BUCKET = 'shipment-media';

class InventoryService extends BaseService {
  constructor() {
    super('InventoryService');
  }

  /**
   * Uploads a locally-captured shipment photo to the private shipment-media
   * bucket, namespaced under the manager's own id (matches the storage RLS
   * policy: `(storage.foldername(name))[1] = auth.uid()::text`).
   * @returns {Promise<string>} the storage path (not a public URL)
   */
  async uploadShipmentPhoto(uri, managerId) {
    debugLog('info', 'InventoryService', 'Uploading shipment photo', { managerId });

    try {
      this.validateRequired(['uri', 'managerId'], { uri, managerId });

      // response.blob() logs a perf warning in dev (RN's Blob polyfill does
      // a base64 roundtrip) but works correctly and is what Expo Go actually
      // has bundled. expo-blob would silence the warning but needs a native
      // module Expo Go doesn't ship yet — not worth trading a working upload
      // for a console warning. Revisit once this app has a custom dev client.
      const response = await fetch(uri);
      const blob = await response.blob();
      const path = `${managerId}/${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' });

      if (error) {
        console.error('❌ [InventoryService] Photo upload failed:', error);
        throw new Error(error.message || 'Failed to upload shipment photo');
      }

      return path;
    } catch (error) {
      this.log('error', 'uploadShipmentPhoto failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Atomically registers a receiving batch (gps + media + N branch_inventory
   * rows) via the receive_stock_batch RPC.
   */
  async receiveStockBatch({ branchId, latitude, longitude, deviceModel, deviceOs, storagePath, items }) {
    debugLog('info', 'InventoryService', 'Registering receiving batch', {
      branchId,
      itemCount: items?.length,
    });

    try {
      this.validateRequired(['branchId', 'storagePath'], { branchId, storagePath });

      const { data, error } = await supabase.rpc('receive_stock_batch', {
        p_branch_id: branchId,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_storage_path: storagePath,
        p_device_model: deviceModel ?? null,
        p_device_os: deviceOs ?? null,
        p_items: items.map((item) => ({
          product_code: item.code,
          product_name: item.name,
          quantity: item.registeredQty,
          mfg_date: item.mfgDate || null,
          exp_date: item.expDate || null,
        })),
      });

      if (error) {
        console.error('❌ [InventoryService] receive_stock_batch RPC error:', error);
        throw new Error(error.message || 'Failed to register incoming stock');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'receiveStockBatch failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to register incoming stock' };
    }
  }
}

const inventoryService = new InventoryService();
export default inventoryService;
