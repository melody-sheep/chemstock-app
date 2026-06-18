// admin-cli/utils/auditLogger.js
// ============================================
// 📊 AUDIT LOGGING MODULE
// Tracks all activation and key management activities
// ============================================

const { supabase } = require('../config/supabase');

/**
 * Audit Log Entry Structure:
 * 
 * {
 *   id: UUID (auto-generated),
 *   action: 'validate_key' | 'activate_manager' | 'generate_key' | 'revoke_key',
 *   activation_key: string,
 *   manager_email: string,
 *   status: 'success' | 'failed',
 *   ip_address: string,
 *   user_agent: string,
 *   branch_id: UUID (optional),
 *   error_message: string (optional),
 *   created_at: timestamp (auto-generated)
 * }
 * 
 * Why this matters:
 * - Detects security breaches early
 * - Provides forensic evidence after breaches
 * - Meets compliance requirements (GDPR, DPA 2012)
 * - Enables accountability for actions
 * - Helps identify attack patterns
 */

class AuditLogger {
  constructor() {
    this.enabled = process.env.AUDIT_LOG_ENABLED !== 'false';
    this.retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 90;
    
    if (this.enabled) {
      console.log('📊 [Audit] Audit logging ENABLED');
      console.log(`📊 [Audit] Retention: ${this.retentionDays} days`);
    } else {
      console.log('⚠️  [Audit] Audit logging DISABLED');
    }
  }

  /**
   * Log an activation attempt
   */
  async logActivation({
    activationKey,
    managerEmail,
    status,
    ipAddress,
    userAgent,
    errorMessage = null,
    branchId = null,
    action = 'validate_key'
  }) {
    if (!this.enabled) return;

    try {
      const { data, error } = await supabase
        .from('activation_audit_log')
        .insert({
          action,
          activation_key: activationKey,
          manager_email: managerEmail,
          status,
          ip_address: ipAddress,
          user_agent: userAgent,
          branch_id: branchId,
          error_message: errorMessage
        });

      if (error) {
        console.error('❌ [Audit] Failed to log:', error.message);
        return;
      }

      // Console log for immediate visibility
      const statusEmoji = status === 'success' ? '✅' : '❌';
      console.log(`${statusEmoji} [Audit] ${action} | ${managerEmail} | ${status}`);
      
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      console.error('❌ [Audit] Error:', error.message);
    }
  }

  /**
   * Log key generation
   */
  async logKeyGeneration({
    activationKey,
    managerEmail,
    managerName,
    branches,
    ipAddress,
    userAgent,
    status = 'success',
    errorMessage = null
  }) {
    return this.logActivation({
      activationKey,
      managerEmail,
      status,
      ipAddress,
      userAgent,
      errorMessage,
      action: 'generate_key'
    });
  }

  /**
   * Log key revocation
   */
  async logKeyRevocation({
    activationKey,
    managerEmail,
    ipAddress,
    userAgent,
    status = 'success',
    errorMessage = null
  }) {
    return this.logActivation({
      activationKey,
      managerEmail,
      status,
      ipAddress,
      userAgent,
      errorMessage,
      action: 'revoke_key'
    });
  }

  /**
   * Log manager activation (from mobile app)
   */
  async logManagerActivation({
    activationKey,
    managerEmail,
    branchId,
    ipAddress,
    userAgent,
    status = 'success',
    errorMessage = null
  }) {
    return this.logActivation({
      activationKey,
      managerEmail,
      status,
      ipAddress,
      userAgent,
      errorMessage,
      branchId,
      action: 'activate_manager'
    });
  }

  /**
   * Get recent audit logs (admin only)
   */
  async getRecentLogs(limit = 100) {
    if (!this.enabled) return { success: false, error: 'Audit logging disabled' };

    try {
      const { data, error } = await supabase
        .from('activation_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data };

    } catch (error) {
      console.error('❌ [Audit] Failed to get logs:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs() {
    if (!this.enabled) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      const { error } = await supabase
        .from('activation_audit_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;
      console.log(`📊 [Audit] Cleaned up logs older than ${this.retentionDays} days`);

    } catch (error) {
      console.error('❌ [Audit] Cleanup failed:', error.message);
    }
  }

  /**
   * Get audit statistics
   */
  async getStats() {
    if (!this.enabled) return { success: false, error: 'Audit logging disabled' };

    try {
      const { data, error } = await supabase
        .from('activation_audit_log')
        .select('status');

      if (error) throw error;

      const total = data?.length || 0;
      const success = data?.filter(l => l.status === 'success').length || 0;
      const failed = data?.filter(l => l.status === 'failed').length || 0;

      return {
        success: true,
        data: { total, success, failed, successRate: total > 0 ? (success / total * 100).toFixed(1) : 0 }
      };

    } catch (error) {
      console.error('❌ [Audit] Failed to get stats:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const auditLogger = new AuditLogger();

// Run cleanup on startup
auditLogger.cleanupOldLogs();

module.exports = { auditLogger };