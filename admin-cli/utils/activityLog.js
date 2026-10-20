// admin-cli/utils/activityLog.js
// Records what each admin does in the admin tool: who, from which computer,
// what, on what, and whether it worked. Saved in the shared Supabase table
// admin_activity_log (2026-10-20e); if that isn't there yet, or the
// connection is down, the same line goes to admin-cli/logs/admin-activity.jsonl
// so nothing is lost. Never throws — logging can't break the action itself.
//
// Never record secrets: activation codes are always masked here.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { supabase } = require('../config/supabase');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'admin-activity.jsonl');
const MACHINE = os.hostname();

const maskCode = (code) => {
  const text = String(code || '');
  return text.length <= 4 ? '****' : `${text.slice(0, 2)}…${text.slice(-2)}`;
};

function writeLocal(entry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  } catch (error) {
    console.error('❌ [Activity] Could not write the local log:', error.message);
  }
}

/**
 * @param {{ adminName?: string, ip?: string }} who
 * @param {string} action e.g. 'key_generated'
 * @param {{ target?: string, details?: object, status?: 'success'|'failed' }} [info]
 */
async function log(who, action, { target = null, details = null, status = 'success' } = {}) {
  const entry = {
    created_at: new Date().toISOString(),
    admin_name: who?.adminName || 'unknown',
    machine: MACHINE,
    ip_address: who?.ip || null,
    action,
    target,
    details,
    status,
  };
  console.log(`📝 [Activity] ${entry.admin_name} · ${action}${target ? ` · ${target}` : ''}${status === 'failed' ? ' · FAILED' : ''}`);
  try {
    const { error } = await supabase.from('admin_activity_log').insert({ ...entry, created_at: undefined });
    if (error) throw error;
  } catch (error) {
    writeLocal(entry);
  }
}

/** Latest entries (database first, local file entries added if any). */
async function recent(limit = 500) {
  let rows = [];
  try {
    const { data, error } = await supabase
      .from('admin_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    rows = data || [];
  } catch (error) {
    rows = [];
  }
  try {
    if (fs.existsSync(LOG_FILE)) {
      const local = fs
        .readFileSync(LOG_FILE, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try {
            return { id: `local-${line.length}-${Math.random().toString(36).slice(2, 8)}`, ...JSON.parse(line), local: true };
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);
      rows = rows.concat(local);
    }
  } catch (error) {
    /* ignore */
  }
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
}

module.exports = { log, recent, maskCode };
