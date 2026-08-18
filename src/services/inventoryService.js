// src/services/inventoryService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';
// /legacy: same reason as ReceiveStockPreviewScreen — the new default
// File/Paths API needs a native module Expo Go doesn't ship yet.
import * as FileSystem from 'expo-file-system/legacy';
import { base64ToUint8Array } from '../utils/base64';

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

      // Previously used fetch(uri).blob() here — RN's Blob polyfill silently
      // corrupts binary data from local file:// URIs on some setups. The
      // upload call never errored, but the stored bytes decoded as "unknown
      // image format." Reading as base64 and decoding it ourselves (no new
      // dependency — see utils/base64.js) sidesteps RN's Blob handling
      // entirely and is Supabase's own recommended pattern for RN uploads.
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToUint8Array(base64);
      const path = `${managerId}/${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg' });

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

  /**
   * All branch_inventory rows (one per received batch/line item) for the
   * given branch(es), sorted soonest-expiring-first for FIFO visibility.
   */
  async getBranchStock(branchIds) {
    debugLog('info', 'InventoryService', 'Fetching branch stock', { branchIds });

    if (!branchIds || branchIds.length === 0) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase
        .from('branch_inventory')
        .select('*')
        .in('branch_id', branchIds)
        .order('exp_date', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('❌ [InventoryService] getBranchStock error:', error);
        throw new Error(error.message || 'Failed to load branch stock');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getBranchStock failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load branch stock', data: [] };
    }
  }

  /**
   * Receiving transactions (one row per "Add New Batches" submission) for
   * the given branch(es), each with its line items, GPS, and photo metadata
   * embedded via the FK relationships — no separate queries/grouping needed.
   */
  async getReceivingLogs(branchIds, limit = 20) {
    debugLog('info', 'InventoryService', 'Fetching receiving logs', { branchIds, limit });

    if (!branchIds || branchIds.length === 0) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase
        .from('receiving_batches')
        .select(
          '*, gps_coordinates(latitude, longitude), media(storage_path, device_model, device_os), branch_inventory(product_code, product_name, batch_number, quantity, mfg_date, exp_date)'
        )
        .in('branch_id', branchIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [InventoryService] getReceivingLogs error:', error);
        throw new Error(error.message || 'Failed to load receiving logs');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getReceivingLogs failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load receiving logs', data: [] };
    }
  }

  /**
   * Short-lived signed URL for a shipment photo (the bucket is private).
   * Returns null on failure so callers can just hide the image instead of
   * crashing the detail view.
   */
  async getShipmentPhotoUrl(storagePath) {
    if (!storagePath) return null;

    try {
      const { data, error } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .createSignedUrl(storagePath, 300);

      if (error) {
        console.error('❌ [InventoryService] getShipmentPhotoUrl error:', error);
        return null;
      }

      return data?.signedUrl || null;
    } catch (error) {
      this.log('error', 'getShipmentPhotoUrl failed', { error: error.message });
      return null;
    }
  }
}

const inventoryService = new InventoryService();
export default inventoryService;
