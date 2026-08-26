// src/services/reportService.js
import { BaseService } from './BaseService';
import { supabase } from './supabaseClient';
import { debugLog } from '../utils/logger';

class ReportService extends BaseService {
  constructor() {
    super('ReportService');
  }

  // ---------------------------------------------------------------------
  // Sales Rep-facing
  // ---------------------------------------------------------------------

  /**
   * Today's live in-custody-per-product breakdown + whether today's report
   * is already submitted. Also triggers the lazy overdue-report
   * reconciliation server-side (see _file_overdue_sr_reports).
   */
  async getMySrReportStatus(agentId) {
    debugLog('info', 'ReportService', 'Fetching my SR report status', { agentId });

    if (!agentId) {
      return { success: true, data: { reportDate: null, alreadySubmitted: false, items: [] } };
    }

    try {
      const { data, error } = await supabase.rpc('get_my_sr_report_status', { p_agent_id: agentId });

      if (error) {
        console.error('[ERROR] [ReportService] get_my_sr_report_status RPC error:', error);
        throw new Error(error.message || 'Failed to load report status');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'getMySrReportStatus failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load report status' };
    }
  }

  /**
   * Submits today's daily report. items: [{ productCode, soldQuantity, returnQuantity }]
   * for exactly every product currently in custody (all-or-nothing, enforced
   * server-side).
   */
  async submitDailyReport({ agentId, latitude, longitude, deviceModel, deviceOs, items }) {
    debugLog('info', 'ReportService', 'Submitting daily report', { agentId, itemCount: items?.length });

    try {
      this.validateRequired(['agentId'], { agentId });

      const { data, error } = await supabase.rpc('submit_daily_report', {
        p_agent_id: agentId,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_device_model: deviceModel ?? null,
        p_device_os: deviceOs ?? null,
        p_items: (items || []).map((item) => ({
          product_code: item.productCode,
          sold_quantity: item.soldQuantity,
          return_quantity: item.returnQuantity,
        })),
      });

      if (error) {
        console.error('[ERROR] [ReportService] submit_daily_report RPC error:', error);
        throw new Error(error.message || 'Failed to submit report');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'submitDailyReport failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to submit report' };
    }
  }

  /**
   * Submits a "resolve discrepancy / return stock" request for one report
   * item. No QR — photo proof only.
   */
  async requestDiscrepancyResolution({ agentId, reportItemId, latitude, longitude, storagePath, deviceModel, deviceOs }) {
    debugLog('info', 'ReportService', 'Requesting discrepancy resolution', { agentId, reportItemId });

    try {
      this.validateRequired(['agentId', 'reportItemId', 'storagePath'], { agentId, reportItemId, storagePath });

      const { data, error } = await supabase.rpc('request_discrepancy_resolution', {
        p_agent_id: agentId,
        p_report_item_id: reportItemId,
        p_latitude: latitude ?? null,
        p_longitude: longitude ?? null,
        p_storage_path: storagePath,
        p_device_model: deviceModel ?? null,
        p_device_os: deviceOs ?? null,
      });

      if (error) {
        console.error('[ERROR] [ReportService] request_discrepancy_resolution RPC error:', error);
        throw new Error(error.message || 'Failed to submit return request');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'requestDiscrepancyResolution failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to submit return request' };
    }
  }

  async getMyDailyReports(agentId, limit = 30) {
    debugLog('info', 'ReportService', 'Fetching my daily reports', { agentId, limit });

    if (!agentId) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_my_daily_reports', { p_agent_id: agentId, p_limit: limit });

      if (error) {
        console.error('[ERROR] [ReportService] get_my_daily_reports RPC error:', error);
        throw new Error(error.message || 'Failed to load your reports');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getMyDailyReports failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load your reports', data: [] };
    }
  }

  async getMyDiscrepancies(agentId, limit = 50) {
    debugLog('info', 'ReportService', 'Fetching my discrepancies', { agentId, limit });

    if (!agentId) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_my_discrepancies', { p_agent_id: agentId, p_limit: limit });

      if (error) {
        console.error('[ERROR] [ReportService] get_my_discrepancies RPC error:', error);
        throw new Error(error.message || 'Failed to load discrepancies');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getMyDiscrepancies failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load discrepancies', data: [] };
    }
  }

  async getMyReturnRequests(agentId, limit = 50) {
    debugLog('info', 'ReportService', 'Fetching my return requests', { agentId, limit });

    if (!agentId) {
      return { success: true, data: [] };
    }

    try {
      const { data, error } = await supabase.rpc('get_my_return_requests', { p_agent_id: agentId, p_limit: limit });

      if (error) {
        console.error('[ERROR] [ReportService] get_my_return_requests RPC error:', error);
        throw new Error(error.message || 'Failed to load return requests');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getMyReturnRequests failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load return requests', data: [] };
    }
  }

  // ---------------------------------------------------------------------
  // Manager-facing
  // ---------------------------------------------------------------------

  async acceptDailyReport(reportId) {
    debugLog('info', 'ReportService', 'Accepting daily report', { reportId });

    try {
      this.validateRequired(['reportId'], { reportId });

      const { error } = await supabase.rpc('accept_daily_report', { p_report_id: reportId });

      if (error) {
        console.error('[ERROR] [ReportService] accept_daily_report RPC error:', error);
        throw new Error(error.message || 'Failed to accept report');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'acceptDailyReport failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to accept report' };
    }
  }

  async acceptDiscrepancyResolution(requestId) {
    debugLog('info', 'ReportService', 'Accepting discrepancy resolution', { requestId });

    try {
      this.validateRequired(['requestId'], { requestId });

      const { error } = await supabase.rpc('accept_discrepancy_resolution', { p_request_id: requestId });

      if (error) {
        console.error('[ERROR] [ReportService] accept_discrepancy_resolution RPC error:', error);
        throw new Error(error.message || 'Failed to accept return request');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'acceptDiscrepancyResolution failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to accept return request' };
    }
  }

  async rejectDiscrepancyResolution(requestId, reason) {
    debugLog('info', 'ReportService', 'Rejecting discrepancy resolution', { requestId });

    try {
      this.validateRequired(['requestId'], { requestId });

      const { error } = await supabase.rpc('reject_discrepancy_resolution', {
        p_request_id: requestId,
        p_reason: reason ?? null,
      });

      if (error) {
        console.error('[ERROR] [ReportService] reject_discrepancy_resolution RPC error:', error);
        throw new Error(error.message || 'Failed to reject return request');
      }

      return { success: true };
    } catch (error) {
      this.log('error', 'rejectDiscrepancyResolution failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to reject return request' };
    }
  }

  async getBranchDailyReports(limit = 50) {
    debugLog('info', 'ReportService', 'Fetching branch daily reports', { limit });

    try {
      const { data, error } = await supabase.rpc('get_branch_daily_reports', { p_limit: limit });

      if (error) {
        console.error('[ERROR] [ReportService] get_branch_daily_reports RPC error:', error);
        throw new Error(error.message || 'Failed to load reports');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getBranchDailyReports failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load reports', data: [] };
    }
  }

  async getBranchDiscrepancies(limit = 200) {
    debugLog('info', 'ReportService', 'Fetching branch discrepancies', { limit });

    try {
      const { data, error } = await supabase.rpc('get_branch_discrepancies', { p_limit: limit });

      if (error) {
        console.error('[ERROR] [ReportService] get_branch_discrepancies RPC error:', error);
        throw new Error(error.message || 'Failed to load discrepancies');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getBranchDiscrepancies failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load discrepancies', data: [] };
    }
  }

  async getBranchReturnRequests(limit = 100) {
    debugLog('info', 'ReportService', 'Fetching branch return requests', { limit });

    try {
      const { data, error } = await supabase.rpc('get_branch_return_requests', { p_limit: limit });

      if (error) {
        console.error('[ERROR] [ReportService] get_branch_return_requests RPC error:', error);
        throw new Error(error.message || 'Failed to load return requests');
      }

      return { success: true, data: data || [] };
    } catch (error) {
      this.log('error', 'getBranchReturnRequests failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load return requests', data: [] };
    }
  }

  async getBranchReport(branchId, periodStart, periodEnd) {
    debugLog('info', 'ReportService', 'Fetching branch report', { branchId, periodStart, periodEnd });

    try {
      this.validateRequired(['branchId', 'periodStart', 'periodEnd'], { branchId, periodStart, periodEnd });

      const { data, error } = await supabase.rpc('get_branch_report', {
        p_branch_id: branchId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

      if (error) {
        console.error('[ERROR] [ReportService] get_branch_report RPC error:', error);
        throw new Error(error.message || 'Failed to load branch report');
      }

      return { success: true, data };
    } catch (error) {
      this.log('error', 'getBranchReport failed', { error: error.message });
      return { success: false, message: error.message || 'Failed to load branch report' };
    }
  }
}

const reportService = new ReportService();
export default reportService;
