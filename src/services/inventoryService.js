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
      // received_quantity (not quantity) is what a log should show — it's
      // an immutable snapshot from when the batch was received, whereas
      // quantity is live current stock and drops as the batch gets
      // released (down to 0, never deleted — see 2026-08-21 migration).
      const { data, error } = await supabase
        .from('receiving_batches')
        .select(
          '*, gps_coordinates(latitude, longitude), media(storage_path, device_model, device_os), branch_inventory(product_code, product_name, batch_number, received_quantity, mfg_date, exp_date)'
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
   * Release transactions (one row per completed Release Stock flow) for the
   * given branch(es), each with its line items, GPS, and photo metadata
   * embedded — same shape/pattern as getReceivingLogs.
   */
  async getReleaseLogs(branchIds, limit = 20) {
    debugLog('info', 'InventoryService', 'Fetching release logs', { branchIds, limit });

    if (!branchIds || branchIds.length === 0) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          '*, gps_coordinates(latitude, longitude), media(storage_path, device_model, device_os), transaction_details(product_code, product_name, batch_number, quantity, mfg_date, exp_date)'
        )
        .in('branch_id', branchIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [InventoryService] getReleaseLogs error:', error);
        throw new Error(error.message || 'Failed to load release logs');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getReleaseLogs failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load release logs', data: [] };
    }
  }

  /**
   * Receiving + release logs merged into one chronological feed, each entry
   * tagged with `logType` ('receiving' | 'release') so a shared UI can tell
   * them apart. Fetches `limit` of each and returns the newest `limit`
   * overall — simplest correct approach without a SQL-level UNION view.
   */
  async getActivityLogs(branchIds, limit = 20) {
    const [receiving, release] = await Promise.all([
      this.getReceivingLogs(branchIds, limit),
      this.getReleaseLogs(branchIds, limit),
    ]);

    const tagged = [
      ...(receiving.data || []).map((log) => ({ ...log, logType: 'receiving' })),
      ...(release.data || []).map((log) => ({ ...log, logType: 'release' })),
    ];

    tagged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      success: receiving.success && release.success,
      data: tagged.slice(0, limit),
    };
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

  /**
   * Looks up a single receiving_batches row by its QR code, embedding its
   * still-live branch_inventory rows (whatever's left after any prior
   * partial releases — this is a live query, not a snapshot). Used by both
   * the Release Stock QR-scan review screen and Quick Register's
   * post-registration hydration step.
   *
   * Callers must handle two distinct states: `data === null` (unrecognized
   * QR, or it belongs to a branch this manager can't see) and a present row
   * with an empty `branch_inventory` array (batch already fully released).
   */
  async getReceivingBatchByQrCode(qrCode, branchIds) {
    debugLog('info', 'InventoryService', 'Looking up receiving batch by QR', { qrCode });

    if (!branchIds || branchIds.length === 0) {
      return { success: true, data: null };
    }

    try {
      const { data, error } = await supabase
        .from('receiving_batches')
        .select('id, branch_id, qr_code, branch_inventory(id, product_code, product_name, batch_number, quantity, mfg_date, exp_date)')
        .eq('qr_code', qrCode)
        .in('branch_id', branchIds)
        .maybeSingle();

      if (error) {
        console.error('❌ [InventoryService] getReceivingBatchByQrCode error:', error);
        throw new Error(error.message || 'Failed to look up that QR code');
      }

      return { success: true, data: data || null };
    } catch (error) {
      this.log('error', 'getReceivingBatchByQrCode failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to look up that QR code', data: null };
    }
  }

  /**
   * Atomically releases stock to a recipient (Sales Rep/Collector) via the
   * release_stock_batch RPC — deducts (or deletes, if fully depleted) the
   * matching branch_inventory rows, writes a transactions/transaction_details
   * ledger entry, and returns the release's own qr_code for the recipient
   * to scan later.
   */
  async releaseStockBatch({
    branchId,
    recipientId,
    movementType = 'direct',
    latitude,
    longitude,
    deviceModel,
    deviceOs,
    storagePath,
    items,
  }) {
    debugLog('info', 'InventoryService', 'Releasing stock batch', {
      branchId,
      recipientId,
      itemCount: items?.length,
    });

    try {
      this.validateRequired(['branchId', 'recipientId', 'storagePath'], { branchId, recipientId, storagePath });

      const { data, error } = await supabase.rpc('release_stock_batch', {
        p_branch_id: branchId,
        p_recipient_id: recipientId,
        p_movement_type: movementType,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_storage_path: storagePath,
        p_device_model: deviceModel ?? null,
        p_device_os: deviceOs ?? null,
        p_items: (items || []).map((item) => ({
          branch_inventory_id: item.branchInventoryId,
          product_code: item.productCode,
          product_name: item.productName,
          quantity: item.releaseQty,
        })),
      });

      if (error) {
        console.error('❌ [InventoryService] release_stock_batch RPC error:', error);
        throw new Error(error.message || 'Failed to release stock');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'releaseStockBatch failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to release stock' };
    }
  }
}

const inventoryService = new InventoryService();
export default inventoryService;
