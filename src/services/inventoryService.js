// src/services/inventoryService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';
// /legacy: same reason as ReceiveStockPreviewScreen — the new default
// File/Paths API needs a native module Expo Go doesn't ship yet.
import * as FileSystem from 'expo-file-system/legacy';
import { base64ToUint8Array } from '../utils/base64';
import { resolveProfilePhotoUrls } from '../utils/profilePhoto';

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
        console.error('[ERROR] [InventoryService] Photo upload failed:', error);
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
        console.error('[ERROR] [InventoryService] receive_stock_batch RPC error:', error);
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
        console.error('[ERROR] [InventoryService] getBranchStock error:', error);
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
        console.error('[ERROR] [InventoryService] getReceivingLogs error:', error);
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
      // transactions now has two FKs into gps_coordinates (gps_id = origin,
      // destination_gps_id = the Collector-path "Deliver to" point), so an
      // unqualified `gps_coordinates(...)` embed is ambiguous and PostgREST
      // rejects it (PGRST201) — for every row, not just collector ones. The
      // `!gps_id`/`!destination_gps_id` hints tell it which FK to use.
      const { data, error } = await supabase
        .from('transactions')
        .select(
          '*, origin_gps:gps_coordinates!gps_id(latitude, longitude), destination_gps:gps_coordinates!destination_gps_id(latitude, longitude), media(storage_path, device_model, device_os), transaction_details(product_code, product_name, batch_number, quantity, mfg_date, exp_date)'
        )
        .in('branch_id', branchIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[ERROR] [InventoryService] getReleaseLogs error:', error);
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
        console.error('[ERROR] [InventoryService] getShipmentPhotoUrl error:', error);
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
        console.error('[ERROR] [InventoryService] getReceivingBatchByQrCode error:', error);
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
   * release_stock_batch RPC — decrements the matching branch_inventory rows
   * (down to 0, never deleted — see 2026-08-21 migration), writes a
   * transactions/transaction_details ledger entry, and returns the release's
   * own qr_code for the recipient to scan later.
   *
   * For a Collector ('collector') movementType, also pass targetRecipientId
   * (the ultimate Sales Rep the collector is delivering to) and
   * destinationLatitude/destinationLongitude (the pinned "Deliver to" point)
   * — all three are optional/null for a direct Sales Rep release.
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
    targetRecipientId,
    destinationLatitude,
    destinationLongitude,
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
        p_target_recipient_id: targetRecipientId ?? null,
        p_destination_latitude: destinationLatitude ?? null,
        p_destination_longitude: destinationLongitude ?? null,
      });

      if (error) {
        console.error('[ERROR] [InventoryService] release_stock_batch RPC error:', error);
        throw new Error(error.message || 'Failed to release stock');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'releaseStockBatch failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to release stock' };
    }
  }

  /**
   * Collector-mediated releases only (movement_type = 'collector'), each
   * with its recipients' ids (resolved to names by the caller via
   * agentService.getMyAgentAccounts, same pattern as getActivityLogs),
   * both GPS points, items, and delivery_status. delivery_checkpoints is
   * embedded too — empty today since nothing writes to it yet (no
   * Collector-side "update my location" button exists), but the shape is
   * ready for whenever that lands.
   */
  async getDeliveries(branchIds, limit = 50) {
    debugLog('info', 'InventoryService', 'Fetching deliveries', { branchIds, limit });

    if (!branchIds || branchIds.length === 0) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          '*, origin_gps:gps_coordinates!gps_id(latitude, longitude), destination_gps:gps_coordinates!destination_gps_id(latitude, longitude), transaction_details(product_code, product_name, batch_number, quantity), delivery_checkpoints(latitude, longitude, label, created_at)'
        )
        .eq('movement_type', 'collector')
        .in('branch_id', branchIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[ERROR] [InventoryService] getDeliveries error:', error);
        throw new Error(error.message || 'Failed to load deliveries');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getDeliveries failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load deliveries', data: [] };
    }
  }

  /**
   * Uploads a Sales Rep/Collector's stock-acceptance proof photo. Agents
   * are always `anon` (no Supabase Auth session — see agentService), so the
   * per-manager-folder upload policy on this same bucket can never match
   * them; a distinct `sr-acceptances/` path prefix has its own anon-facing
   * INSERT policy instead (2026-08-23_sr_receive_stock.sql).
   * @returns {Promise<string>} the storage path (not a public URL)
   */
  async uploadStockAcceptancePhoto(uri, agentId) {
    debugLog('info', 'InventoryService', 'Uploading stock acceptance photo', { agentId });

    try {
      this.validateRequired(['uri', 'agentId'], { uri, agentId });

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToUint8Array(base64);
      const path = `sr-acceptances/${agentId}/${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg' });

      if (error) {
        console.error('[ERROR] [InventoryService] Stock acceptance photo upload failed:', error);
        throw new Error(error.message || 'Failed to upload photo');
      }

      return path;
    } catch (error) {
      this.log('error', 'uploadStockAcceptancePhoto failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Uploads a Sales Rep's discrepancy-resolution ("return stock") proof
   * photo. Same anon-agent path-prefix pattern as uploadStockAcceptancePhoto,
   * distinct prefix/policy (2026-08-26_sr_daily_reports_and_returns.sql).
   * @returns {Promise<string>} the storage path (not a public URL)
   */
  async uploadDiscrepancyPhoto(uri, agentId) {
    debugLog('info', 'InventoryService', 'Uploading discrepancy resolution photo', { agentId });

    try {
      this.validateRequired(['uri', 'agentId'], { uri, agentId });

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToUint8Array(base64);
      const path = `sr-discrepancy-resolutions/${agentId}/${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from(SHIPMENT_BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg' });

      if (error) {
        console.error('[ERROR] [InventoryService] Discrepancy resolution photo upload failed:', error);
        throw new Error(error.message || 'Failed to upload photo');
      }

      return path;
    } catch (error) {
      this.log('error', 'uploadDiscrepancyPhoto failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Looks up a release transaction by its QR code, agent-side. Sales Reps/
   * Collectors have no Supabase Auth session (auth.uid() is always null for
   * them), so this can't be a plain RLS-gated `.from().select()` like the
   * manager-side equivalents — it goes through a SECURITY DEFINER RPC that
   * takes the agent's id explicitly and re-validates it server-side.
   */
  async getTransactionByQrCodeForAgent(qrCode, agentId) {
    debugLog('info', 'InventoryService', 'Looking up transaction by QR for agent', { agentId });

    try {
      this.validateRequired(['qrCode', 'agentId'], { qrCode, agentId });

      const { data, error } = await supabase.rpc('get_transaction_by_qr_code_for_agent', {
        p_qr_code: qrCode,
        p_agent_id: agentId,
      });

      if (error) {
        console.error('[ERROR] [InventoryService] get_transaction_by_qr_code_for_agent RPC error:', error);
        throw new Error(error.message || 'Transaction not found or not assigned to you');
      }

      const photoUrlByPath = await resolveProfilePhotoUrls([data?.receivedByPhotoPath, data?.releasedByPhotoPath]);
      const enrichedData = {
        ...data,
        receivedByPhotoUrl: data?.receivedByPhotoPath ? photoUrlByPath[data.receivedByPhotoPath] || null : null,
        releasedByPhotoUrl: data?.releasedByPhotoPath ? photoUrlByPath[data.releasedByPhotoPath] || null : null,
      };

      return { success: true, data: enrichedData };
    } catch (error) {
      this.log('error', 'getTransactionByQrCodeForAgent failed', { error: error.message });
      return { success: false, message: error.message || 'Transaction not found or not assigned to you' };
    }
  }

  /**
   * Confirms a Sales Rep/Collector's receipt of a release transaction —
   * atomically records their own GPS+photo proof and credits the matching
   * line items into their personal sr_inventory ledger. Blocked server-side
   * from running twice against the same transaction.
   */
  async acceptStockRelease({ qrCode, agentId, latitude, longitude, deviceModel, deviceOs, storagePath }) {
    debugLog('info', 'InventoryService', 'Accepting stock release', { agentId, qrCode });

    try {
      this.validateRequired(['qrCode', 'agentId', 'storagePath'], { qrCode, agentId, storagePath });

      const { data, error } = await supabase.rpc('accept_stock_release', {
        p_qr_code: qrCode,
        p_agent_id: agentId,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_storage_path: storagePath,
        p_device_model: deviceModel ?? null,
        p_device_os: deviceOs ?? null,
      });

      if (error) {
        console.error('[ERROR] [InventoryService] accept_stock_release RPC error:', error);
        throw new Error(error.message || 'Failed to accept stock');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'acceptStockRelease failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to accept stock' };
    }
  }

  /**
   * A Sales Rep/Collector's own personal stock ledger (built from accepted
   * releases, not the branch warehouse) — agent-facing RPC, same auth.uid()
   * caveat as getTransactionByQrCodeForAgent above.
   */
  async getSrInventory(agentId) {
    debugLog('info', 'InventoryService', 'Fetching SR inventory', { agentId });

    if (!agentId) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_sr_inventory', { p_agent_id: agentId });

      if (error) {
        console.error('[ERROR] [InventoryService] get_sr_inventory RPC error:', error);
        throw new Error(error.message || 'Failed to load your stock');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getSrInventory failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load your stock', data: [] };
    }
  }

  /**
   * A Sales Rep/Collector's own accepted-stock history — the agent-facing
   * equivalent of getActivityLogs, built entirely inside the RPC (no
   * PostgREST embed available to an anon caller).
   */
  async getSrActivityLogs(agentId, limit = 20) {
    debugLog('info', 'InventoryService', 'Fetching SR activity logs', { agentId, limit });

    if (!agentId) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_sr_activity_logs', {
        p_agent_id: agentId,
        p_limit: limit,
      });

      if (error) {
        console.error('[ERROR] [InventoryService] get_sr_activity_logs RPC error:', error);
        throw new Error(error.message || 'Failed to load activity logs');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getSrActivityLogs failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load activity logs', data: [] };
    }
  }

  /**
   * Collector-mediated deliveries where this Sales Rep is the ultimate
   * target_recipient — the agent-facing mirror of getDeliveries() above,
   * scoped to one recipient instead of a branch since agents can't use the
   * manager side's RLS-gated PostgREST embed.
   */
  async getMyDeliveries(agentId, limit = 50) {
    debugLog('info', 'InventoryService', 'Fetching my deliveries', { agentId, limit });

    if (!agentId) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_my_deliveries', {
        p_agent_id: agentId,
        p_limit: limit,
      });

      if (error) {
        console.error('[ERROR] [InventoryService] get_my_deliveries RPC error:', error);
        throw new Error(error.message || 'Failed to load deliveries');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getMyDeliveries failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load deliveries', data: [] };
    }
  }
}

const inventoryService = new InventoryService();
export default inventoryService;
