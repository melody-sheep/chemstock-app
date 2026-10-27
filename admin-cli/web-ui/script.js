/* ============================================
   CHEMSTOCK ADMIN CONSOLE
   No inline handlers: everything is wired with data-action attributes and
   one delegated click listener, so the page's CSP can forbid inline scripts.
   ============================================ */
(() => {
  'use strict';

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const icon = (name, extra = '') => `<i class="ph ph-${name} ${extra}"></i>`;
  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
  const fmtDateTime = (v) =>
    v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const timeAgo = (v) => {
    if (!v) return 'Never';
    const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
    return fmtDate(v);
  };
  const initials = (name) =>
    String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  const avatar = (person, size = '') =>
    `<div class="avatar ${size}">${person.photoUrl ? `<img src="${esc(person.photoUrl)}" alt="" />` : esc(initials(person.name))}</div>`;
  const STATUS_LABEL = { available: 'Available', used: 'Used', expired: 'Expired', revoked: 'Revoked' };
  const ACTION_LABEL = {
    generate_key: 'Key generated',
    revoke_key: 'Key revoked',
    extend_key: 'Key extended',
    activate_manager: 'Manager activated',
    validate_key: 'Key checked',
    deactivate_manager: 'Manager deactivated',
    reactivate_manager: 'Manager reactivated',
    update_manager_branches: 'Manager branches changed',
    update_branch: 'Branch edited',
  };
  const ACTIVITY_LABEL = {
    login: 'Logged in',
    logout: 'Logged out',
    login_failed: 'Wrong password',
    login_locked: 'Login locked (too many tries)',
    login_blocked: 'Login attempt while locked',
    key_generated: 'Generated a key',
    key_revoked: 'Revoked a key',
    key_extended: 'Extended a key',
    manager_deactivated: 'Deactivated a manager',
    manager_reactivated: 'Reactivated a manager',
    manager_branches_changed: 'Changed a manager’s branches',
    branch_edited: 'Edited a branch',
    qr_shown: 'Showed a key QR code',
    codes_revealed: 'Revealed key codes',
    code_copied: 'Copied a key code',
    audit_exported: 'Exported the activation log',
    activity_exported: 'Exported the admin activity',
  };
  const logEvent = (type, target) => api('POST', '/api/activity/event', { type, target }).catch(() => {});
  const copyText = async (text, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      toast(label, 'success');
    } catch (e) {
      toast('Could not copy', 'error');
    }
  };

  // ---------- API ----------
  async function api(method, url, body) {
    const options = { method, headers: { 'X-Requested-With': 'chemstock-admin' }, credentials: 'same-origin' };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(url, options);
    } catch (e) {
      setConnection(false);
      throw new Error('Cannot reach the admin server.');
    }
    setConnection(true);
    if (response.status === 401 && !url.startsWith('/api/auth/')) {
      showLogin('Your session ended. Please log in again.');
      throw new Error('Please log in.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      const error = new Error(result.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.details = result;
      throw error;
    }
    return result.data;
  }

  function setConnection(ok) {
    const pill = $('#connection');
    pill.className = `pill ${ok ? 'pill-ok' : 'pill-bad'}`;
    $('#connection-text').textContent = ok ? 'Connected' : 'Offline';
  }

  // ---------- toast / modal / drawer / menu ----------
  function toast(message, type = 'info') {
    const icons = { success: 'check-circle', error: 'warning-circle', info: 'info' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `${icon(icons[type])}<span>${esc(message)}</span>`;
    $('#toast-root').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  function confirmDialog({ title, message, confirmText = 'Confirm', danger = false, iconName = 'question', showLogo = false }) {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="overlay" data-close></div>
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          ${showLogo ? '<div class="modal-logo"><img src="assets/logo.png" alt="ChemStock" /></div>' : `<div class="modal-icon ${danger ? 'tone-bad' : 'tone-accent'}">${icon(iconName)}</div>`}
          <h3 id="modal-title">${esc(title)}</h3>
          <p>${esc(message)}</p>
          <div class="modal-actions">
            <button class="btn" data-answer="no">Cancel</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-answer="yes">${esc(confirmText)}</button>
          </div>
        </div>`;
      const done = (answer) => {
        root.innerHTML = '';
        document.removeEventListener('keydown', onKey);
        resolve(answer);
      };
      const onKey = (e) => {
        if (e.key === 'Escape') done(false);
      };
      document.addEventListener('keydown', onKey);
      root.querySelector('[data-close]').addEventListener('click', () => done(false));
      root.querySelector('[data-answer="no"]').addEventListener('click', () => done(false));
      root.querySelector('[data-answer="yes"]').addEventListener('click', () => done(true));
      root.querySelector('[data-answer="yes"]').focus();
    });
  }

  function openDrawer(title, bodyHtml, footHtml = '') {
    $('#drawer-root').innerHTML = `
      <div class="overlay" data-action="close-drawer"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="drawer-head"><h3>${esc(title)}</h3><button class="btn btn-ghost btn-icon" data-action="close-drawer" aria-label="Close">${icon('x')}</button></div>
        <div class="drawer-body">${bodyHtml}</div>
        ${footHtml ? `<div class="drawer-foot">${footHtml}</div>` : ''}
      </aside>`;
  }
  const closeDrawer = () => {
    $('#drawer-root').innerHTML = '';
  };

  function openMenu(anchor, items) {
    closeMenu();
    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.id = 'open-menu';
    menu.innerHTML = items
      .map((it, i) => `<button data-menu-index="${i}" class="${it.danger ? 'danger' : ''}">${icon(it.icon)}${esc(it.label)}</button>`)
      .join('');
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    const top = Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 10);
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(10, r.right - menu.offsetWidth)}px`;
    menu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-menu-index]');
      if (!btn) return;
      closeMenu();
      items[Number(btn.dataset.menuIndex)].run();
    });
  }
  const closeMenu = () => document.getElementById('open-menu')?.remove();

  // ---------- login ----------
  function showLogin(message = '') {
    $('#app').hidden = true;
    $('#login-screen').hidden = false;
    $('#login-error').textContent = message;
    $('#admin-password').value = '';
    $('#admin-password').focus();
  }

  async function submitLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const result = await api('POST', '/api/auth/login', { password: $('#admin-password').value });
      $('#admin-password').value = '';
      startApp(result?.adminName);
    } catch (error) {
      $('#login-error').textContent = error.message;
    } finally {
      btn.disabled = false;
    }
  }

  async function logout() {
    const ok = await confirmDialog({
      title: 'Log out?',
      message: 'You will need the admin password to come back in.',
      confirmText: 'Log out',
      danger: true,
      iconName: 'sign-out',
      showLogo: true,
    });
    if (!ok) return;
    await api('POST', '/api/auth/logout').catch(() => {});
    showLogin();
  }

  // ---------- router ----------
  const VIEWS = {
    dashboard: { title: 'Dashboard', sub: 'Overview of keys, managers and branches', render: renderDashboard },
    keys: { title: 'Activation Keys', sub: 'Every key issued to a manager', render: renderKeys },
    generate: { title: 'Generate Key', sub: 'Create an activation key for a new manager', render: renderGenerate },
    managers: { title: 'Managers', sub: 'Activated manager accounts', render: renderManagers },
    branches: { title: 'Branches', sub: 'Branches and who runs them', render: renderBranches },
    audit: { title: 'Activation Log', sub: 'Key and activation events, including from the mobile app', render: renderAudit },
    activity: { title: 'Admin Activity', sub: 'Everything done in this admin tool, by whom', render: renderActivity },
  };
  let currentView = 'dashboard';

  function go(view) {
    if (!VIEWS[view]) view = 'dashboard';
    currentView = view;
    closeMenu();
    closeDrawer();
    document.querySelectorAll('.nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $('#page-title').textContent = VIEWS[view].title;
    $('#page-sub').textContent = VIEWS[view].sub;
    try {
      localStorage.setItem('cs_admin_view', view);
    } catch (e) {
      /* not essential */
    }
    $('#view').innerHTML = `<div class="empty">${icon('circle-notch', 'spin')} Loading…</div>`;
    VIEWS[view].render().catch((error) => {
      $('#view').innerHTML = `<div class="card glass"><div class="notice notice-bad">${icon('warning-circle')}<div>${esc(error.message)}</div></div></div>`;
    });
  }

  let appStarted = false;
  function setWhoAmI(name) {
    $('#whoami-name').textContent = name || '—';
    $('#whoami-avatar').textContent = initials(name || '?');
  }

  function startApp(name) {
    if (name) setWhoAmI(name);
    $('#login-screen').hidden = true;
    $('#app').hidden = false;
    if (!appStarted) {
      appStarted = true;
      const tick = () => {
        $('#clock').textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      };
      tick();
      setInterval(tick, 1000);
    }
    let saved = 'dashboard';
    try {
      saved = localStorage.getItem('cs_admin_view') || 'dashboard';
    } catch (e) {
      /* not essential */
    }
    go(saved);
  }

  // ============================================
  // DASHBOARD
  // ============================================
  async function renderDashboard() {
    const [stats, keys, managers, logs] = await Promise.all([
      api('GET', '/api/stats'),
      api('GET', '/api/keys'),
      api('GET', '/api/managers').catch(() => []),
      api('GET', '/api/audit-logs?limit=8').catch(() => []),
    ]);
    const stat = (label, value, ic, tone, view) => `
      <button class="stat glass ${view ? 'clickable' : ''}" ${view ? `data-view-link="${view}"` : ''}>
        <div class="stat-top"><div class="stat-icon tone-${tone}">${icon(ic)}</div></div>
        <div><div class="stat-value">${value}</div><div class="stat-label">${esc(label)}</div></div>
      </button>`;

    const weekAhead = Date.now() + 7 * 86400000;
    const expiring = keys.filter((k) => k.status === 'available' && k.expiresAt && new Date(k.expiresAt).getTime() < weekAhead);
    const deactivated = managers.filter((m) => !m.active);
    const attention = [
      ...expiring.map((k) => ({ ic: 'clock-countdown', tone: 'warn', title: `${k.managerName}'s key expires ${fmtDate(k.expiresAt)}`, sub: k.managerEmail, view: 'keys' })),
      ...deactivated.map((m) => ({ ic: 'user-minus', tone: 'bad', title: `${m.name} is deactivated`, sub: m.email, view: 'managers' })),
    ];

    $('#view').innerHTML = `
      <div class="grid grid-stats">
        ${stat('Total keys', stats.total, 'key', 'accent', 'keys')}
        ${stat('Available', stats.available, 'check-circle', 'ok', 'keys')}
        ${stat('Used', stats.used, 'user-check', 'accent', 'keys')}
        ${stat('Expired', stats.expired, 'clock-countdown', 'warn', 'keys')}
        ${stat('Revoked', stats.revoked, 'prohibit', 'bad', 'keys')}
        ${stat('Managers', stats.managers, 'users-three', 'accent', 'managers')}
        ${stat('Branches', stats.branches, 'buildings', 'muted', 'branches')}
      </div>
      <div class="grid grid-2">
        <div class="card glass">
          <div class="card-head"><div class="card-title">${icon('bell-ringing')} Needs attention</div></div>
          ${
            attention.length
              ? `<div class="list">${attention
                  .map(
                    (a) => `<button class="list-row clickable" data-view-link="${a.view}" style="text-align:left;width:100%">
                      <span class="stat-icon tone-${a.tone}" style="width:36px;height:36px;font-size:19px">${icon(a.ic)}</span>
                      <span class="list-main"><span class="list-title">${esc(a.title)}</span><div class="list-sub">${esc(a.sub)}</div></span>
                      ${icon('caret-right')}
                    </button>`
                  )
                  .join('')}</div>`
              : `<div class="empty">${icon('check-circle')}Nothing needs attention.</div>`
          }
        </div>
        <div class="card glass">
          <div class="card-head"><div class="card-title">${icon('clock-counter-clockwise')} Recent activity</div>
            <button class="btn btn-sm" data-view-link="audit">View all ${icon('arrow-right')}</button></div>
          ${
            logs.length
              ? `<div class="list">${logs
                  .map(
                    (l) => `<div class="list-row">
                      <span class="stat-icon ${l.status === 'success' ? 'tone-ok' : 'tone-bad'}" style="width:36px;height:36px;font-size:19px">${icon(l.status === 'success' ? 'check' : 'x')}</span>
                      <span class="list-main"><span class="list-title">${esc(ACTION_LABEL[l.action] || l.action)}</span>
                        <div class="list-sub">${esc(l.email || '—')} · ${esc(timeAgo(l.createdAt))}</div></span>
                    </div>`
                  )
                  .join('')}</div>`
              : `<div class="empty">${icon('scroll')}No activity yet.</div>`
          }
        </div>
      </div>`;
  }

  // ============================================
  // ACTIVATION KEYS
  // ============================================
  const keysState = { all: [], filter: 'all', query: '', page: 1, reveal: false };
  const PAGE_SIZE = 12;

  async function renderKeys() {
    keysState.all = await api('GET', '/api/keys');
    keysState.page = 1;
    drawKeys();
  }

  function drawKeys() {
    const counts = { all: keysState.all.length, available: 0, used: 0, expired: 0, revoked: 0 };
    keysState.all.forEach((k) => {
      counts[k.status] += 1;
    });
    const q = keysState.query.toLowerCase();
    const rows = keysState.all.filter(
      (k) =>
        (keysState.filter === 'all' || k.status === keysState.filter) &&
        (!q || [k.managerName, k.managerEmail, k.branchNames.join(' ')].join(' ').toLowerCase().includes(q))
    );
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    keysState.page = Math.min(keysState.page, pages);
    const pageRows = rows.slice((keysState.page - 1) * PAGE_SIZE, keysState.page * PAGE_SIZE);

    const chip = (id, label) =>
      `<button class="chip ${keysState.filter === id ? 'active' : ''}" data-action="keys-filter" data-filter="${id}">${label}<span class="count">${counts[id]}</span></button>`;

    $('#view').innerHTML = `
      <div class="card glass">
        <div class="toolbar">
          <div class="input-icon grow">${icon('magnifying-glass')}<input id="keys-search" class="input" placeholder="Search manager, email or branch" value="${esc(keysState.query)}" autocomplete="off" /></div>
          <button class="btn" data-action="keys-reveal">${icon(keysState.reveal ? 'eye-slash' : 'eye')} ${keysState.reveal ? 'Hide codes' : 'Show codes'}</button>
          <button class="btn btn-primary" data-view-link="generate">${icon('plus')} New key</button>
        </div>
        <div class="chips" style="margin-bottom:16px">
          ${chip('all', 'All')}${chip('available', 'Available')}${chip('used', 'Used')}${chip('expired', 'Expired')}${chip('revoked', 'Revoked')}
        </div>
        ${
          pageRows.length
            ? `<div class="table-wrap"><table class="table">
                <thead><tr><th>Code</th><th>Manager</th><th>Branches</th><th>Status</th><th>Expires</th><th class="actions"></th></tr></thead>
                <tbody>${pageRows
                  .map(
                    (k) => `<tr>
                      <td><span class="code-cell"><span class="code-text ${keysState.reveal ? '' : 'masked'}">${esc(k.code)}</span>
                        <button class="btn btn-ghost btn-icon" data-action="key-copy" data-id="${k.id}" title="Copy code">${icon('copy')}</button></span></td>
                      <td><div>${esc(k.managerName)}</div><div class="cell-sub">${esc(k.managerEmail)}</div></td>
                      <td>${esc(k.branchNames.join(', ') || '—')}</td>
                      <td><span class="badge badge-${k.status}">${STATUS_LABEL[k.status]}</span>
                        ${k.activatedBy ? `<div class="cell-sub">by ${esc(k.activatedBy)}</div>` : ''}</td>
                      <td>${fmtDate(k.expiresAt)}</td>
                      <td class="actions"><button class="btn btn-ghost btn-icon" data-action="key-menu" data-id="${k.id}" aria-label="Key actions">${icon('dots-three-vertical')}</button></td>
                    </tr>`
                  )
                  .join('')}</tbody></table></div>
              <div class="pager"><span>${rows.length} key${rows.length === 1 ? '' : 's'}</span>
                <span class="chips">
                  <button class="btn btn-sm" data-action="keys-page" data-delta="-1" ${keysState.page <= 1 ? 'disabled' : ''}>${icon('caret-left')}</button>
                  <span style="padding:7px 4px">Page ${keysState.page} of ${pages}</span>
                  <button class="btn btn-sm" data-action="keys-page" data-delta="1" ${keysState.page >= pages ? 'disabled' : ''}>${icon('caret-right')}</button>
                </span></div>`
            : `<div class="empty">${icon('key')}No keys match.</div>`
        }
      </div>`;

    const search = $('#keys-search');
    search.addEventListener(
      'input',
      debounce(() => {
        keysState.query = search.value;
        keysState.page = 1;
        drawKeys();
        const again = $('#keys-search');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 250)
    );
  }

  async function showQr(id) {
    const key = keysState.all.find((k) => k.id === id) || { managerName: '' };
    try {
      const { dataUrl } = await api('GET', `/api/keys/${id}/qr`);
      openDrawer(
        'Activation key QR',
        `<p class="field-hint">The manager can scan this instead of typing the code.</p>
         <img class="qr-img" src="${esc(dataUrl)}" alt="QR code of the activation key" />
         <p style="text-align:center;margin-top:14px">${esc(key.managerName)}</p>`
      );
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function keyMenu(anchor, id) {
    const key = keysState.all.find((k) => k.id === id);
    if (!key) return;
    const items = [
      { icon: 'copy', label: 'Copy code', run: () => { logEvent('code_copied', key.managerName); copyText(key.code, 'Code copied'); } },
      { icon: 'qr-code', label: 'Show QR code', run: () => showQr(id) },
    ];
    if (key.status === 'available' || key.status === 'expired') {
      items.push({ icon: 'clock-clockwise', label: 'Extend 7 days', run: () => extendKey(key, 7) });
      items.push({ icon: 'clock-clockwise', label: 'Extend 30 days', run: () => extendKey(key, 30) });
    }
    if (key.status === 'available' || key.status === 'expired') {
      items.push({ icon: 'prohibit', label: 'Revoke key', danger: true, run: () => revokeKey(key) });
    }
    openMenu(anchor, items);
  }

  async function extendKey(key, days) {
    try {
      await api('POST', `/api/keys/${key.id}/extend`, { days });
      toast(`Key extended by ${days} days`, 'success');
      renderKeys();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function revokeKey(key) {
    const ok = await confirmDialog({
      title: 'Revoke this key?',
      message: `${key.managerName} won't be able to activate with it. This can't be undone.`,
      confirmText: 'Revoke',
      danger: true,
      iconName: 'prohibit',
    });
    if (!ok) return;
    try {
      await api('DELETE', `/api/keys/${key.id}`);
      toast('Key revoked', 'success');
      renderKeys();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  // ============================================
  // GENERATE KEY (3-step wizard)
  // ============================================
  const freshForm = () => ({
    step: 1,
    name: '',
    email: '',
    days: 30,
    emailCheck: null,
    branches: [], // { id, name, city } existing  |  { name, city, region, address, isNew: true, createAnyway }
    keyMode: 'auto',
    suggested: '',
    custom: '',
    customTaken: false,
    acceptMedium: false,
    similarWarning: null,
    result: null,
  });
  let form = freshForm();
  let allBranches = [];

  async function renderGenerate() {
    allBranches = await api('GET', '/api/branches');
    if (!form.suggested) form.suggested = (await api('GET', '/api/keys/suggest')).code;
    drawGenerate();
  }

  const stepsHtml = () => {
    const step = (n, label) =>
      `<div class="step ${form.step === n ? 'active' : form.step > n ? 'done' : ''}"><span class="step-num">${form.step > n ? icon('check') : n}</span>${label}</div>`;
    return `<div class="steps">${step(1, 'Manager')}<span class="step-line"></span>${step(2, 'Branches')}<span class="step-line"></span>${step(3, 'Key & review')}</div>`;
  };

  const currentCode = () => (form.keyMode === 'auto' ? form.suggested : form.custom.trim());

  function summaryHtml() {
    const row = (ic, html) => `<div class="summary-row">${icon(ic)}<div>${html}</div></div>`;
    const muted = (t) => `<span class="muted">${t}</span>`;
    return `<aside class="summary glass">
      <h4>${icon('clipboard-text')} Summary</h4>
      ${row('user', form.name ? esc(form.name) : muted('Manager name'))}
      ${row('envelope-simple', form.email ? esc(form.email) : muted('Email'))}
      ${row('buildings', form.branches.length ? form.branches.map((b) => esc(b.name) + (b.isNew ? ' <span class="badge badge-success">NEW</span>' : '')).join('<br>') : muted('No branch yet'))}
      ${row('key', form.step === 3 ? (form.keyMode === 'auto' ? 'Generated (very strong)' : 'Typed by you') : muted('Chosen in step 3'))}
      ${row('hourglass', `Valid for ${form.days} days`)}
    </aside>`;
  }

  function drawGenerate() {
    if (form.result) return drawResult();
    let body = '';
    if (form.step === 1) body = stepOneHtml();
    if (form.step === 2) body = stepTwoHtml();
    if (form.step === 3) body = stepThreeHtml();
    $('#view').innerHTML = `
      <div class="wizard">
        <div class="card glass">${stepsHtml()}${body}</div>
        ${summaryHtml()}
      </div>`;
    if (form.step === 1) wireStepOne();
    if (form.step === 2) wireStepTwo();
    if (form.step === 3) wireStepThree();
  }

  // ---- step 1
  function emailNoticeHtml() {
    const c = form.emailCheck;
    if (!c) return '';
    if (c.valid === false) return `<div class="notice notice-bad">${icon('warning-circle')}<div>That doesn't look like a valid email.</div></div>`;
    const notes = [];
    if (c.legit && c.legit.legit === false) {
      notes.push(
        `<div class="notice notice-bad">${icon('warning-circle')}<div>${esc(c.legit.message)}${
          c.legit.suggestion ? `<div class="notice-actions"><button class="btn btn-sm" data-action="use-email-suggestion" data-email="${esc(c.legit.suggestion)}">${icon('check')} Use ${esc(c.legit.suggestion)}</button></div>` : ''
        }</div></div>`
      );
    }
    if (c.account) {
      notes.push(
        `<div class="notice notice-warn">${icon('warning')}<div>This email already has an account: <b>${esc(c.account.name)}</b> (${esc(c.account.role.replace('_', ' '))}${c.account.branches.length ? ' · ' + esc(c.account.branches.join(', ')) : ''}). A new key can't be activated with it.</div></div>`
      );
    }
    if (c.openKey) {
      notes.push(
        `<div class="notice notice-warn">${icon('key')}<div>There's already an unused key for this email (expires ${fmtDate(c.openKey.expiresAt)}). Consider extending it in Activation Keys instead.</div></div>`
      );
    }
    if (!c.legit) {
      notes.push(`<div class="notice notice-warn">${icon('warning')}<div>The email check did not run. Restart the admin tool (<code>npm run web</code>) so it uses the latest server code.</div></div>`);
    }
    if (!notes.length) notes.push(`<div class="notice notice-ok">${icon('check-circle')}<div>Email looks real and is free to use.${c.legit && c.legit.unchecked ? ' (Could not reach the internet to check its domain.)' : ''}</div></div>`);
    return notes.join('');
  }

  const stepOneHtml = () => `
    <div class="stack">
      <div class="form-grid">
        <div class="field"><label class="field-label" for="f-name">Manager full name</label>
          <input id="f-name" class="input" placeholder="e.g. Gio Niel" value="${esc(form.name)}" autocomplete="off" /></div>
        <div class="field"><label class="field-label" for="f-email">Email address</label>
          <input id="f-email" class="input" type="email" placeholder="name@example.com" value="${esc(form.email)}" autocomplete="off" />
          <span class="field-hint">The manager must sign up with exactly this email.</span></div>
      </div>
      <div id="email-notice" class="stack">${emailNoticeHtml()}</div>
      <div class="field"><span class="field-label">Valid for</span>
        <div class="chips">${[7, 14, 30, 60, 90].map((d) => `<button class="chip ${form.days === d ? 'active' : ''}" data-action="set-days" data-days="${d}">${d} days</button>`).join('')}</div>
      </div>
    </div>
    <div class="form-actions"><span></span><button class="btn btn-primary" data-action="step-next">Next ${icon('arrow-right')}</button></div>`;

  function wireStepOne() {
    const name = $('#f-name');
    const email = $('#f-email');
    name.addEventListener('input', () => {
      form.name = name.value;
      refreshSummary();
    });
    const checkEmail = debounce(async () => {
      const value = email.value.trim();
      if (!value) {
        form.emailCheck = null;
      } else {
        try {
          form.emailCheck = await api('GET', `/api/check-email?email=${encodeURIComponent(value)}`);
        } catch (e) {
          form.emailCheck = null;
        }
      }
      $('#email-notice').innerHTML = emailNoticeHtml();
    }, 400);
    email.addEventListener('input', () => {
      form.email = email.value;
      refreshSummary();
      checkEmail();
    });
    name.focus();
  }

  function refreshSummary() {
    const old = $('.summary');
    if (old) old.outerHTML = summaryHtml();
  }

  // ---- step 2
  let branchQuery = '';
  let newBranch = null; // { name, city, region, address }
  let placeResults = [];

  function stepTwoHtml() {
    const q = branchQuery.toLowerCase();
    const list = allBranches.filter((b) => !q || `${b.name} ${b.city || ''} ${b.region || ''}`.toLowerCase().includes(q));
    const isChosen = (id) => form.branches.some((b) => b.id === id);
    const warning = form.similarWarning;
    const creating = !!newBranch;

    const selected = form.branches.length
      ? form.branches
          .map(
            (b, i) => `<span class="selected-chip">${icon('buildings')} ${esc(b.name)} ${b.isNew ? '<span class="new">NEW</span>' : ''}
              <button data-action="remove-branch" data-index="${i}" aria-label="Remove ${esc(b.name)}">${icon('x')}</button></span>`
          )
          .join('')
      : `<span class="selected-empty">${icon('info')} Nothing selected yet. Pick a branch below, or create a new one.</span>`;

    const existingPanel = `
      <div class="picker-search">
        <div class="input-icon">${icon('magnifying-glass')}<input id="branch-search" class="input input-lg" placeholder="Search by branch name, city or region" value="${esc(branchQuery)}" autocomplete="off" /></div>
        <div class="picker-count">${list.length} of ${allBranches.length} branches${q ? ` matching “${esc(branchQuery)}”` : ''}</div>
      </div>
      <div class="branch-list">${
        list.length
          ? list
              .map(
                (b) => `<label class="branch-option ${isChosen(b.id) ? 'checked' : ''}">
                  <input type="checkbox" data-action="toggle-branch" data-id="${b.id}" ${isChosen(b.id) ? 'checked' : ''} />
                  <span class="branch-option-icon">${icon('buildings')}</span>
                  <span class="branch-option-main">
                    <span class="branch-option-name">${esc(b.name)}</span>
                    <span class="branch-option-sub">${icon('map-pin')} ${esc([b.city, b.region].filter(Boolean).join(', ') || 'No location')}</span>
                  </span>
                  <span class="branch-option-managers">${b.managers.length ? esc(b.managers.join(', ')) : '<span class="badge badge-muted">No manager yet</span>'}</span>
                </label>`
              )
              .join('')
          : `<div class="empty">${icon('buildings')}No branch matches “${esc(branchQuery)}”.<div style="margin-top:12px"><button class="btn btn-sm" data-action="open-new-branch">${icon('plus')} Create it as a new branch</button></div></div>`
      }</div>`;

    const newPanel = `
      <div class="new-branch stack">
        <div class="form-section">
          <div class="form-section-title"><span class="num">1</span> Find the place</div>
          <div class="input-icon">${icon('magnifying-glass')}<input id="place-search" class="input input-lg" placeholder="e.g. Iponan, Cagayan de Oro" autocomplete="off" /></div>
          <div id="place-results"></div>
          <span class="osm-note">Locations © OpenStreetMap contributors · Philippines only. Picking a result fills in the boxes below.</span>
        </div>
        <div class="form-section">
          <div class="form-section-title"><span class="num">2</span> Branch details</div>
          <div class="field"><label class="field-label" for="nb-name">Branch name</label>
            <input id="nb-name" class="input" placeholder="e.g. Iponan Branch" value="${esc(newBranch ? newBranch.name : '')}" autocomplete="off" /></div>
          <div id="similar-box">${warning ? similarHtml(warning) : ''}</div>
          <div class="form-grid">
            <div class="field"><label class="field-label" for="nb-city">City / town</label>
              <input id="nb-city" class="input" value="${esc(newBranch ? newBranch.city : '')}" autocomplete="off" /></div>
            <div class="field"><label class="field-label" for="nb-region">Province / region</label>
              <input id="nb-region" class="input" value="${esc(newBranch ? newBranch.region : '')}" autocomplete="off" /></div>
          </div>
          <div class="field"><label class="field-label" for="nb-address">Address <span class="optional">(optional)</span></label>
            <input id="nb-address" class="input" value="${esc(newBranch ? newBranch.address : '')}" autocomplete="off" /></div>
        </div>
        <div class="chips form-end"><button class="btn" data-action="cancel-new-branch">Cancel</button>
          <button class="btn btn-primary" data-action="add-new-branch">${icon('plus')} Add this branch</button></div>
      </div>`;

    return `
      <div class="step-form">
        <div class="step-intro">
          <h3>Which branches will this manager run?</h3>
          <p>The manager sees stock and agents only for the branches chosen here.</p>
        </div>

        <div class="selected-box">
          <div class="selected-box-head"><span class="field-label">Selected (${form.branches.length})</span></div>
          <div class="selected-chips">${selected}</div>
        </div>

        <div class="seg" role="tablist">
          <button class="seg-btn ${creating ? '' : 'active'}" data-action="cancel-new-branch" role="tab">${icon('list-magnifying-glass')} Choose an existing branch</button>
          <button class="seg-btn ${creating ? 'active' : ''}" data-action="open-new-branch" role="tab">${icon('plus-circle')} Create a new branch</button>
        </div>

        <div class="panel">${creating ? newPanel : existingPanel}</div>
      </div>
      <div class="form-actions"><button class="btn" data-action="step-back">${icon('arrow-left')} Back</button>
        <button class="btn btn-primary" data-action="step-next">Next ${icon('arrow-right')}</button></div>`;
  }

  function similarHtml(w) {
    return `<div class="notice notice-warn">${icon('warning')}<div>
      <b>A branch like "${esc(w.forName)}" already exists:</b>
      <div style="margin-top:6px">${w.matches
        .map((m) => `${esc(m.name)}${m.city ? ` · ${esc(m.city)}` : ''} <span class="badge badge-muted">${esc(m.reason)}</span>`)
        .join('<br>')}</div>
      <div class="notice-actions">
        ${w.matches.map((m) => `<button class="btn btn-sm" data-action="use-existing" data-id="${m.id}">${icon('check')} Use ${esc(m.name)}</button>`).join('')}
        <button class="btn btn-sm btn-danger" data-action="create-anyway">Create anyway</button>
      </div></div></div>`;
  }

  function wireStepTwo() {
    const search = $('#branch-search');
    search?.addEventListener(
      'input',
      debounce(() => {
        branchQuery = search.value;
        syncNewBranchFields();
        drawGenerate();
        const again = $('#branch-search');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 200)
    );
    if (!newBranch) return;

    const place = $('#place-search');
    const runSearch = debounce(async () => {
      const q = place.value.trim();
      const box = $('#place-results');
      if (q.length < 3) {
        box.innerHTML = '';
        return;
      }
      box.innerHTML = `<div class="field-hint" style="padding:8px 2px">${icon('circle-notch', 'spin')} Searching…</div>`;
      try {
        placeResults = await api('GET', `/api/places?q=${encodeURIComponent(q)}`);
        box.innerHTML = placeResults.length
          ? `<div class="place-results">${placeResults
              .map((p, i) => `<button data-action="pick-place" data-index="${i}">${icon('map-pin')}<span>${esc(p.label)}</span></button>`)
              .join('')}</div>`
          : `<div class="field-hint" style="padding:8px 2px">No place found. You can type the location below.</div>`;
      } catch (error) {
        box.innerHTML = `<div class="field-hint" style="padding:8px 2px">${esc(error.message)}</div>`;
      }
    }, 450);
    place.addEventListener('input', runSearch);

    const checkSimilar = debounce(async () => {
      const name = $('#nb-name')?.value.trim();
      if (!name || name.length < 2) {
        form.similarWarning = null;
        $('#similar-box').innerHTML = '';
        return;
      }
      try {
        const matches = await api('GET', `/api/branches/similar?name=${encodeURIComponent(name)}`);
        form.similarWarning = matches.length ? { forName: name, matches } : null;
        newBranch.createAnyway = false;
        $('#similar-box').innerHTML = form.similarWarning ? similarHtml(form.similarWarning) : '';
      } catch (e) {
        /* the server checks again on generate */
      }
    }, 350);
    $('#nb-name').addEventListener('input', () => {
      newBranch.name = $('#nb-name').value;
      checkSimilar();
    });
    ['city', 'region', 'address'].forEach((f) =>
      $(`#nb-${f}`).addEventListener('input', (e) => {
        newBranch[f] = e.target.value;
      })
    );
    if (newBranch.name) checkSimilar();
    place.focus();
  }

  function syncNewBranchFields() {
    if (!newBranch) return;
    ['name', 'city', 'region', 'address'].forEach((f) => {
      const el = $(`#nb-${f}`);
      if (el) newBranch[f] = el.value;
    });
  }

  function addNewBranch() {
    syncNewBranchFields();
    const name = newBranch.name.trim();
    if (name.length < 2) return toast('Enter a branch name', 'error');
    if (form.similarWarning && !newBranch.createAnyway) return toast('Pick an existing branch or choose "Create anyway"', 'error');
    if (form.branches.some((b) => b.isNew && b.name.toLowerCase() === name.toLowerCase())) return toast('Already added', 'error');
    form.branches.push({ ...newBranch, name, isNew: true });
    newBranch = null;
    form.similarWarning = null;
    drawGenerate();
  }

  // ---- step 3
  function strengthHtml(code) {
    const s = window.KeyStrength.check(code, {
      name: form.name,
      email: form.email,
      branches: form.branches.map((b) => b.name),
    });
    if (s.level === 'empty') return `<span class="field-hint">Type a key to see how strong it is.</span>`;
    const width = { weak: 25, medium: 55, strong: 80, very_strong: 100 }[s.level];
    return `<div class="strength">
      <div class="strength-bar-row"><div class="strength-bar"><div class="strength-fill fill-${s.level}" style="width:${width}%"></div></div>
        <span class="strength-label lvl-${s.level}">${s.label}${s.level === 'weak' ? ' · can’t be used' : ''}</span></div>
      <div class="checks">${s.checks.map((c) => `<span class="${c.ok ? 'ok' : 'no'}">${icon(c.ok ? 'check-circle' : 'x-circle')}${esc(c.label)}</span>`).join('')}
        <span class="${form.customTaken ? 'no' : 'ok'}">${icon(form.customTaken ? 'x-circle' : 'check-circle')}Not used before</span></div>
      ${
        s.level === 'medium'
          ? `<label class="confirm-line"><input type="checkbox" id="accept-medium" ${form.acceptMedium ? 'checked' : ''} />I understand this key is only medium strength and still want to use it.</label>`
          : ''
      }
    </div>`;
  }

  const stepThreeHtml = () => `
    <div class="stack">
      <div class="radio-cards">
        <label class="radio-card ${form.keyMode === 'auto' ? 'checked' : ''}"><input type="radio" name="keymode" value="auto" data-action="key-mode" ${form.keyMode === 'auto' ? 'checked' : ''} />
          <div><div class="t">Generate a secure key</div><div class="d">Recommended · 16 random characters</div></div></label>
        <label class="radio-card ${form.keyMode === 'custom' ? 'checked' : ''}"><input type="radio" name="keymode" value="custom" data-action="key-mode" ${form.keyMode === 'custom' ? 'checked' : ''} />
          <div><div class="t">Type my own</div><div class="d">Must pass the strength checks</div></div></label>
      </div>
      ${
        form.keyMode === 'auto'
          ? `<div class="key-box"><span class="code-text">${esc(form.suggested)}</span>
              <button class="btn btn-sm" data-action="new-suggestion">${icon('arrows-clockwise')} New</button>
              <button class="btn btn-sm" data-action="copy-suggestion">${icon('copy')} Copy</button></div>
             <div class="checks"><span class="ok">${icon('shield-check')}Very strong · never used before</span></div>`
          : `<div class="field"><label class="field-label" for="f-code">Your key</label>
              <input id="f-code" class="input mono" placeholder="At least 8 characters (letters, numbers, symbols)" value="${esc(form.custom)}" autocomplete="off" spellcheck="false" maxlength="64" />
             </div><div id="strength-box">${strengthHtml(form.custom)}</div>`
      }
      <div class="notice notice-info">${icon('info')}<div>Valid for <b>${form.days} days</b> — until ${fmtDate(Date.now() + form.days * 86400000)}.
        Give the key and the email to the manager privately.</div></div>
      <div id="generate-error"></div>
    </div>
    <div class="form-actions"><button class="btn" data-action="step-back">${icon('arrow-left')} Back</button>
      <button class="btn btn-primary" data-action="generate">${icon('check')} Generate key</button></div>`;

  function wireStepThree() {
    const input = $('#f-code');
    if (!input) return;
    const checkTaken = debounce(async () => {
      try {
        const { exists } = await api('POST', '/api/keys/check-code', { code: form.custom.trim() });
        form.customTaken = exists;
        $('#strength-box').innerHTML = strengthHtml(form.custom);
        wireAcceptMedium();
      } catch (e) {
        /* checked again on generate */
      }
    }, 400);
    input.addEventListener('input', () => {
      form.custom = input.value;
      form.acceptMedium = false;
      form.customTaken = false;
      $('#strength-box').innerHTML = strengthHtml(form.custom);
      wireAcceptMedium();
      checkTaken();
    });
    wireAcceptMedium();
    input.focus();
  }
  function wireAcceptMedium() {
    $('#accept-medium')?.addEventListener('change', (e) => {
      form.acceptMedium = e.target.checked;
    });
  }

  function validateStep(step) {
    if (step === 1) {
      if (form.name.trim().length < 3) return 'Enter the manager’s full name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return 'Enter a valid email address.';
      if (form.emailCheck?.legit?.legit === false) return form.emailCheck.legit.message;
      if (form.emailCheck?.account) return 'This email already has an account.';
    }
    if (step === 2 && form.branches.length === 0) return 'Pick at least one branch.';
    return null;
  }

  async function generate() {
    const code = currentCode();
    if (form.keyMode === 'custom') {
      const s = window.KeyStrength.check(code, { name: form.name, email: form.email, branches: form.branches.map((b) => b.name) });
      if (!s.allowed) return toast('That key is too weak.', 'error');
      if (s.needsConfirm && !form.acceptMedium) return toast('Tick the box to accept a medium-strength key.', 'error');
      if (form.customTaken) return toast('That key was already used.', 'error');
    }
    const btn = $('[data-action="generate"]');
    btn.disabled = true;
    btn.innerHTML = `${icon('circle-notch', 'spin')} Generating…`;
    try {
      const result = await api('POST', '/api/keys/generate', {
        managerName: form.name.trim(),
        managerEmail: form.email.trim(),
        daysValid: form.days,
        // The key shown on screen (generated or typed) is the key that gets saved.
        code,
        acceptMedium: form.acceptMedium,
        branches: form.branches.map((b) =>
          b.isNew ? { name: b.name, city: b.city, region: b.region, address: b.address, createAnyway: Boolean(b.createAnyway) } : { id: b.id }
        ),
      });
      form.result = result;
      toast('Activation key created', 'success');
      drawGenerate();
    } catch (error) {
      const details = error.details || {};
      if (details.similarBranches) {
        form.step = 2;
        const pending = form.branches.find((b) => b.isNew && b.name === details.forName);
        if (pending) {
          form.branches = form.branches.filter((b) => b !== pending);
          newBranch = { name: pending.name, city: pending.city, region: pending.region, address: pending.address };
        }
        form.similarWarning = { forName: details.forName, matches: details.similarBranches };
        drawGenerate();
        toast(error.message, 'error');
        return;
      }
      $('#generate-error').innerHTML = `<div class="notice notice-bad">${icon('warning-circle')}<div>${esc(error.message)}</div></div>`;
      btn.disabled = false;
      btn.innerHTML = `${icon('check')} Generate key`;
    }
  }

  function drawResult() {
    const r = form.result;
    $('#view').innerHTML = `
      <div class="card glass result">
        <div class="result-icon">${icon('check')}</div>
        <h3>Key ready</h3>
        <p class="result-meta">${esc(r.managerName)} · ${esc(r.branchNames.join(', '))} · expires ${fmtDate(r.expiresAt)}</p>
        <div class="key-box"><span class="code-text">${esc(r.code)}</span>
          <button class="btn btn-sm" data-action="copy-result">${icon('copy')} Copy</button>
          <button class="btn btn-sm" data-action="qr-result">${icon('qr-code')} QR</button></div>
        <p class="field-hint">Send it to ${esc(r.managerEmail)} privately. The manager activates in the app with this email.</p>
        <div id="result-qr"></div>
        <div class="result-actions">
          <button class="btn" data-action="generate-another">${icon('plus')} Generate another</button>
          <button class="btn btn-primary" data-view-link="keys">${icon('key')} Go to keys</button>
        </div>
      </div>`;
  }

  // ============================================
  // MANAGERS
  // ============================================
  const managersState = { all: [], filter: 'all', query: '' };

  async function renderManagers() {
    managersState.all = await api('GET', '/api/managers');
    drawManagers();
  }

  function drawManagers() {
    const q = managersState.query.toLowerCase();
    const counts = {
      all: managersState.all.length,
      active: managersState.all.filter((m) => m.active).length,
      deactivated: managersState.all.filter((m) => !m.active).length,
    };
    const rows = managersState.all.filter(
      (m) =>
        (managersState.filter === 'all' || (managersState.filter === 'active' ? m.active : !m.active)) &&
        (!q || [m.name, m.email, m.username, m.branchNames.join(' ')].join(' ').toLowerCase().includes(q))
    );
    const chip = (id, label) =>
      `<button class="chip ${managersState.filter === id ? 'active' : ''}" data-action="managers-filter" data-filter="${id}">${label}<span class="count">${counts[id]}</span></button>`;
    $('#view').innerHTML = `
      <div class="card glass">
        <div class="toolbar">
          <div class="input-icon grow">${icon('magnifying-glass')}<input id="managers-search" class="input" placeholder="Search name, email or branch" value="${esc(managersState.query)}" autocomplete="off" /></div>
          <div class="chips">${chip('all', 'All')}${chip('active', 'Active')}${chip('deactivated', 'Deactivated')}</div>
        </div>
        ${
          rows.length
            ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Manager</th><th>Branches</th><th>Agents</th><th>Status</th><th>Last sign-in</th><th class="actions"></th></tr></thead>
              <tbody>${rows
                .map(
                  (m) => `<tr class="clickable" data-action="open-manager" data-id="${m.id}">
                    <td><div class="person">${avatar(m)}<div><div>${esc(m.name)}</div><div class="cell-sub">${esc(m.email)}</div></div></div></td>
                    <td>${esc(m.branchNames.join(', ') || '—')}</td>
                    <td>${m.agentCount}</td>
                    <td><span class="badge badge-${m.active ? 'active' : 'deactivated'}">${m.active ? 'Active' : 'Deactivated'}</span></td>
                    <td>${esc(timeAgo(m.lastSignInAt))}</td>
                    <td class="actions">${icon('caret-right')}</td>
                  </tr>`
                )
                .join('')}</tbody></table></div>`
            : `<div class="empty">${icon('users-three')}No managers match.</div>`
        }
      </div>`;
    const search = $('#managers-search');
    search.addEventListener(
      'input',
      debounce(() => {
        managersState.query = search.value;
        drawManagers();
        const again = $('#managers-search');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 200)
    );
  }

  function openManager(id) {
    const m = managersState.all.find((x) => x.id === id);
    if (!m) return;
    const info = (ic, label, value) =>
      `<div class="info-row">${icon(ic)}<div><div class="k">${label}</div><div>${value}</div></div></div>`;
    openDrawer(
      'Manager',
      `<div style="text-align:center">
         <div style="display:flex;justify-content:center">${avatar(m, 'avatar-lg')}</div>
         <h3 style="margin-top:14px;font-size:20px">${esc(m.name)}</h3>
         <div class="cell-sub">@${esc(m.username)}</div>
         <div style="margin-top:10px"><span class="badge badge-${m.active ? 'active' : 'deactivated'}">${m.active ? 'Active' : 'Deactivated'}</span></div>
       </div>
       <div class="info-rows">
         ${info('envelope-simple', 'Email', esc(m.email))}
         ${info('phone', 'Phone', esc(m.phone || 'Not set'))}
         ${info('buildings', 'Branches', esc(m.branchNames.join(', ') || '—'))}
         ${info('users', 'Agents created', m.agentCount)}
         ${info('sign-in', 'Last sign-in', esc(m.lastSignInAt ? `${timeAgo(m.lastSignInAt)} (${fmtDateTime(m.lastSignInAt)})` : 'Never'))}
         ${info('calendar-blank', 'Activated', esc(fmtDate(m.createdAt)))}
       </div>`,
      `<button class="btn" data-action="manager-branches" data-id="${m.id}">${icon('buildings')} Change branches</button>
       ${
         m.active
           ? `<button class="btn btn-danger" data-action="manager-status" data-id="${m.id}" data-active="false">${icon('power')} Deactivate</button>`
           : `<button class="btn btn-primary" data-action="manager-status" data-id="${m.id}" data-active="true">${icon('power')} Reactivate</button>`
       }`
    );
  }

  async function setManagerStatus(id, active) {
    const m = managersState.all.find((x) => x.id === id);
    const ok = await confirmDialog(
      active
        ? { title: `Reactivate ${m.name}?`, message: 'They will be able to log in to the app again.', confirmText: 'Reactivate', iconName: 'power' }
        : {
            title: `Deactivate ${m.name}?`,
            message: 'Their login is blocked right away and the app logs them out at its next check. Their data stays. You can reactivate them later.',
            confirmText: 'Deactivate',
            danger: true,
            iconName: 'power',
          }
    );
    if (!ok) return;
    try {
      await api('POST', `/api/managers/${id}/status`, { active });
      toast(active ? 'Manager reactivated' : 'Manager deactivated', 'success');
      await renderManagers();
      openManager(id);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function editManagerBranches(id) {
    const m = managersState.all.find((x) => x.id === id);
    const branches = await api('GET', '/api/branches');
    const chosen = new Set(m.branchIds);
    openDrawer(
      `Branches · ${m.name}`,
      `<p class="field-hint" style="margin-bottom:12px">The manager sees stock and agents only for the branches ticked here.</p>
       <div class="check-list" id="mb-list">${branches
         .map(
           (b) => `<label class="check-item ${chosen.has(b.id) ? 'checked' : ''}"><input type="checkbox" value="${b.id}" ${chosen.has(b.id) ? 'checked' : ''} />
             <span class="list-main"><span class="list-title">${esc(b.name)}</span><div class="list-sub">${esc([b.city, b.region].filter(Boolean).join(', ') || 'No location')}</div></span></label>`
         )
         .join('')}</div>`,
      `<button class="btn" data-action="open-manager" data-id="${m.id}">Cancel</button>
       <button class="btn btn-primary" data-action="save-manager-branches" data-id="${m.id}">${icon('check')} Save</button>`
    );
    $('#mb-list').addEventListener('change', (e) => e.target.closest('.check-item')?.classList.toggle('checked', e.target.checked));
  }

  async function saveManagerBranches(id) {
    const ids = [...document.querySelectorAll('#mb-list input:checked')].map((i) => i.value);
    if (!ids.length) return toast('Pick at least one branch', 'error');
    try {
      await api('PUT', `/api/managers/${id}/branches`, { branchIds: ids });
      toast('Branches updated', 'success');
      await renderManagers();
      openManager(id);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  // ============================================
  // BRANCHES
  // ============================================
  const branchesState = { all: [], query: '', filter: 'all' };

  async function renderBranches() {
    branchesState.all = await api('GET', '/api/branches');
    drawBranches();
  }

  function drawBranches() {
    const q = branchesState.query.toLowerCase();
    const all = branchesState.all;
    const noManager = all.filter((b) => !b.managers.length).length;
    const rows = all
      .filter((b) => branchesState.filter !== 'nomanager' || !b.managers.length)
      .filter((b) => !q || `${b.name} ${b.city || ''} ${b.region || ''} ${b.managers.join(' ')}`.toLowerCase().includes(q));
    const chip = (key, label, count) =>
      `<button class="filter-chip ${branchesState.filter === key ? 'active' : ''}" data-action="branches-filter" data-filter="${key}">${label} <span class="count">${count}</span></button>`;
    $('#view').innerHTML = `
      <div class="page-intro">
        <div>
          <h2>${all.length} ${all.length === 1 ? 'branch' : 'branches'}</h2>
          <p>A branch can have more than one manager. Use Edit on a card to fix its name or location.</p>
        </div>
        <button class="btn btn-primary" data-view-link="generate">${icon('plus')} Add a branch</button>
      </div>
      <div class="notice notice-info" style="margin-bottom:20px">${icon('info')}<div>
        <b>Where do new branches come from?</b> A branch is created together with its manager, in <b>Generate Key → step 2 → Create a new branch</b>. The button above takes you there.</div></div>
      <div class="branch-tools">
        <div class="input-icon grow">${icon('magnifying-glass')}<input id="branches-search" class="input input-lg" placeholder="Search branch, city, region or manager" value="${esc(branchesState.query)}" autocomplete="off" /></div>
        <div class="chips">${chip('all', 'All', all.length)}${chip('nomanager', 'No manager', noManager)}</div>
      </div>
      ${
        rows.length
          ? `<div class="branch-grid">${rows
              .map(
                (b) => `<article class="branch-card glass">
                  <div class="branch-card-head">
                    <span class="branch-card-icon">${icon('buildings')}</span>
                    <div class="branch-card-title"><b>${esc(b.name)}</b>
                      <span class="cell-sub">Added ${fmtDate(b.createdAt)}</span></div>
                    <button class="btn btn-sm" data-action="edit-branch" data-id="${b.id}">${icon('pencil-simple')} Edit</button>
                  </div>
                  <div class="branch-card-row">${icon('map-pin')}<span>${esc([b.city, b.region].filter(Boolean).join(', ') || 'No location set')}</span></div>
                  <div class="branch-card-row">${icon('users-three')}<span>${b.managers.length ? esc(b.managers.join(', ')) : '<span class="badge badge-muted">No manager yet</span>'}</span></div>
                  <div class="branch-card-row">${icon('user-list')}<span>${b.agentCount} ${b.agentCount === 1 ? 'agent' : 'agents'}</span></div>
                </article>`
              )
              .join('')}</div>`
          : `<div class="empty card glass">${icon('buildings')}No branches match${q ? ` “${esc(branchesState.query)}”` : ''}.</div>`
      }`;
    const search = $('#branches-search');
    search.addEventListener(
      'input',
      debounce(() => {
        branchesState.query = search.value;
        drawBranches();
        const again = $('#branches-search');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 200)
    );
  }

  function editBranch(id, warning = null) {
    const b = branchesState.all.find((x) => x.id === id);
    const field = (key, label, value) =>
      `<div class="field"><label class="field-label" for="eb-${key}">${label}</label><input id="eb-${key}" class="input" value="${esc(value || '')}" autocomplete="off" /></div>`;
    openDrawer(
      'Edit branch',
      `<div class="stack">
        <div class="field"><label class="field-label" for="eb-place">Search the location</label>
          <div class="input-icon">${icon('magnifying-glass')}<input id="eb-place" class="input" placeholder="e.g. Butuan City" autocomplete="off" /></div>
          <div id="eb-results"></div><span class="osm-note">Locations © OpenStreetMap contributors</span></div>
        ${field('name', 'Branch name', b.name)}<div class="form-grid">${field('city', 'City / town', b.city)}${field('region', 'Province / region', b.region)}</div>${field('address', 'Address', b.address)}
        <div id="eb-warning">${
          warning
            ? `<div class="notice notice-warn">${icon('warning')}<div><b>${esc(warning.message)}</b><div style="margin-top:6px">${warning.matches
                .map((m) => `${esc(m.name)} <span class="badge badge-muted">${esc(m.reason)}</span>`)
                .join('<br>')}</div>
                <div class="notice-actions"><button class="btn btn-sm btn-danger" data-action="save-branch" data-id="${b.id}" data-anyway="true">Save anyway</button></div></div></div>`
            : ''
        }</div>
      </div>`,
      `<button class="btn" data-action="close-drawer">Cancel</button>
       <button class="btn btn-primary" data-action="save-branch" data-id="${b.id}">${icon('check')} Save</button>`
    );
    const place = $('#eb-place');
    place.addEventListener(
      'input',
      debounce(async () => {
        const q = place.value.trim();
        const box = $('#eb-results');
        if (q.length < 3) {
          box.innerHTML = '';
          return;
        }
        try {
          placeResults = await api('GET', `/api/places?q=${encodeURIComponent(q)}`);
          box.innerHTML = placeResults.length
            ? `<div class="place-results">${placeResults
                .map((p, i) => `<button data-action="pick-place-edit" data-index="${i}">${icon('map-pin')}<span>${esc(p.label)}</span></button>`)
                .join('')}</div>`
            : '<div class="field-hint" style="padding:8px 2px">No place found.</div>';
        } catch (error) {
          box.innerHTML = `<div class="field-hint" style="padding:8px 2px">${esc(error.message)}</div>`;
        }
      }, 450)
    );
  }

  async function saveBranch(id, anyway) {
    const value = (k) => $(`#eb-${k}`).value.trim();
    try {
      await api('PUT', `/api/branches/${id}`, {
        name: value('name'),
        city: value('city'),
        region: value('region'),
        address: value('address'),
        saveAnyway: anyway,
      });
      toast('Branch saved', 'success');
      closeDrawer();
      renderBranches();
    } catch (error) {
      if (error.details?.similarBranches) {
        const current = { name: value('name'), city: value('city'), region: value('region'), address: value('address') };
        const b = branchesState.all.find((x) => x.id === id);
        Object.assign(b, current);
        editBranch(id, { message: error.message, matches: error.details.similarBranches });
        return;
      }
      toast(error.message, 'error');
    }
  }

  // ============================================
  // AUDIT LOG
  // ============================================
  const auditState = { all: [], status: 'all', action: 'all', query: '' };

  async function renderAudit() {
    auditState.all = await api('GET', '/api/audit-logs?limit=1000');
    drawAudit();
  }

  function filteredAudit() {
    const q = auditState.query.toLowerCase();
    return auditState.all.filter(
      (l) =>
        (auditState.status === 'all' || l.status === auditState.status) &&
        (auditState.action === 'all' || l.action === auditState.action) &&
        (!q || `${l.email || ''} ${l.error || ''}`.toLowerCase().includes(q))
    );
  }

  function drawAudit() {
    const rows = filteredAudit();
    const total = auditState.all.length;
    const ok = auditState.all.filter((l) => l.status === 'success').length;
    const actions = [...new Set(auditState.all.map((l) => l.action))];
    $('#view').innerHTML = `
      <div class="grid grid-stats">
        <div class="stat glass"><div class="stat-top"><div class="stat-icon tone-accent">${icon('scroll')}</div></div><div><div class="stat-value">${total}</div><div class="stat-label">Events</div></div></div>
        <div class="stat glass"><div class="stat-top"><div class="stat-icon tone-ok">${icon('check-circle')}</div></div><div><div class="stat-value">${ok}</div><div class="stat-label">Successful</div></div></div>
        <div class="stat glass"><div class="stat-top"><div class="stat-icon tone-bad">${icon('x-circle')}</div></div><div><div class="stat-value">${total - ok}</div><div class="stat-label">Failed</div></div></div>
      </div>
      <div class="card glass">
        <div class="toolbar">
          <div class="input-icon grow">${icon('magnifying-glass')}<input id="audit-search" class="input" placeholder="Search email or note" value="${esc(auditState.query)}" autocomplete="off" /></div>
          <select id="audit-status" class="select" style="width:auto">
            <option value="all">All statuses</option><option value="success" ${auditState.status === 'success' ? 'selected' : ''}>Successful</option>
            <option value="failed" ${auditState.status === 'failed' ? 'selected' : ''}>Failed</option></select>
          <select id="audit-action" class="select" style="width:auto"><option value="all">All actions</option>
            ${actions.map((a) => `<option value="${esc(a)}" ${auditState.action === a ? 'selected' : ''}>${esc(ACTION_LABEL[a] || a)}</option>`).join('')}</select>
          <button class="btn" data-action="audit-export">${icon('download-simple')} Export CSV</button>
          <button class="btn" data-action="audit-refresh">${icon('arrows-clockwise')}</button>
        </div>
        ${
          rows.length
            ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>Time</th><th>Action</th><th>Email</th><th>Key</th><th>Status</th><th>Note</th></tr></thead>
              <tbody>${rows
                .slice(0, 300)
                .map(
                  (l) => `<tr>
                    <td>${esc(fmtDateTime(l.createdAt))}</td>
                    <td>${esc(ACTION_LABEL[l.action] || l.action)}</td>
                    <td>${esc(l.email || '—')}</td>
                    <td class="mono">${esc(l.key)}</td>
                    <td><span class="badge badge-${l.status === 'success' ? 'success' : 'failed'}">${l.status === 'success' ? 'Success' : 'Failed'}</span></td>
                    <td class="cell-sub">${esc(l.error || '—')}</td>
                  </tr>`
                )
                .join('')}</tbody></table></div>
              ${rows.length > 300 ? `<div class="pager"><span>Showing the latest 300 of ${rows.length}. Export to see all.</span></div>` : ''}`
            : `<div class="empty">${icon('scroll')}No events match.</div>`
        }
      </div>`;
    const search = $('#audit-search');
    search.addEventListener(
      'input',
      debounce(() => {
        auditState.query = search.value;
        drawAudit();
        const again = $('#audit-search');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 250)
    );
    $('#audit-status').addEventListener('change', (e) => {
      auditState.status = e.target.value;
      drawAudit();
    });
    $('#audit-action').addEventListener('change', (e) => {
      auditState.action = e.target.value;
      drawAudit();
    });
  }

  function exportAudit() {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Time', 'Action', 'Email', 'Key', 'Status', 'Note'].map(cell).join(',')];
    filteredAudit().forEach((l) =>
      lines.push([new Date(l.createdAt).toISOString(), ACTION_LABEL[l.action] || l.action, l.email, l.key, l.status, l.error].map(cell).join(','))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chemstock-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ============================================
  // ADMIN ACTIVITY
  // ============================================
  const activityState = { all: [], admin: 'all', action: 'all', status: 'all', query: '' };

  async function renderActivity() {
    activityState.all = await api('GET', '/api/admin-activity?limit=1000');
    drawActivity();
  }

  function filteredActivity() {
    const q = activityState.query.toLowerCase();
    return activityState.all.filter(
      (r) =>
        (activityState.admin === 'all' || r.admin === activityState.admin) &&
        (activityState.action === 'all' || r.action === activityState.action) &&
        (activityState.status === 'all' || r.status === activityState.status) &&
        (!q || `${r.target || ''} ${r.admin} ${r.machine || ''} ${JSON.stringify(r.details || '')}`.toLowerCase().includes(q))
    );
  }

  const activityIcon = (action, status) => {
    if (status === 'failed') return ['warning', 'bad'];
    if (action.startsWith('login') || action === 'logout') return ['sign-in', 'muted'];
    if (action.includes('generated')) return ['plus-circle', 'ok'];
    if (action.includes('revoked') || action.includes('deactivated')) return ['prohibit', 'bad'];
    if (action.includes('revealed') || action.includes('copied') || action.includes('qr')) return ['eye', 'warn'];
    if (action.includes('exported')) return ['download-simple', 'accent'];
    return ['pencil-simple', 'accent'];
  };

  function drawActivity() {
    const rows = filteredActivity();
    const admins = [...new Set(activityState.all.map((r) => r.admin))].sort();
    const actions = [...new Set(activityState.all.map((r) => r.action))].sort();
    const failed = activityState.all.filter((r) => r.status === 'failed').length;
    const hasLocal = activityState.all.some((r) => r.localOnly);
    $('#view').innerHTML = `
      <div class="grid grid-stats">
        <div class="stat glass"><div class="stat-top"><div class="stat-icon tone-accent">${icon('list-checks')}</div></div><div><div class="stat-value">${activityState.all.length}</div><div class="stat-label">Recorded actions</div></div></div>
        <div class="stat glass"><div class="stat-top"><div class="stat-icon tone-ok">${icon('users')}</div></div><div><div class="stat-value">${admins.length}</div><div class="stat-label">Admins</div></div></div>
        <div class="stat glass"><div class="stat-top"><div class="stat-icon tone-bad">${icon('warning')}</div></div><div><div class="stat-value">${failed}</div><div class="stat-label">Failed / blocked</div></div></div>
      </div>
      ${hasLocal ? `<div class="notice notice-warn" style="margin-bottom:16px">${icon('warning')}<div>Some entries are only saved on this computer. Run <b>2026-10-20e_admin_activity_log.sql</b> in Supabase so every admin's activity is kept in one shared place.</div></div>` : ''}
      <div class="card glass">
        <div class="toolbar">
          <div class="input-icon grow">${icon('magnifying-glass')}<input id="activity-search" class="input" placeholder="Search a name, target or detail" value="${esc(activityState.query)}" autocomplete="off" /></div>
          <select id="activity-admin" class="select" style="width:auto"><option value="all">All admins</option>${admins.map((a) => `<option value="${esc(a)}" ${activityState.admin === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select>
          <select id="activity-action" class="select" style="width:auto"><option value="all">All actions</option>${actions.map((a) => `<option value="${esc(a)}" ${activityState.action === a ? 'selected' : ''}>${esc(ACTIVITY_LABEL[a] || a)}</option>`).join('')}</select>
          <select id="activity-status" class="select" style="width:auto"><option value="all">Any result</option>
            <option value="success" ${activityState.status === 'success' ? 'selected' : ''}>Worked</option><option value="failed" ${activityState.status === 'failed' ? 'selected' : ''}>Failed</option></select>
          <button class="btn" data-action="activity-export">${icon('download-simple')} Export CSV</button>
          <button class="btn" data-action="activity-refresh">${icon('arrows-clockwise')}</button>
        </div>
        ${
          rows.length
            ? `<div class="table-wrap"><table class="table">
              <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>On</th><th>Computer</th><th>Result</th></tr></thead>
              <tbody>${rows
                .slice(0, 300)
                .map((r) => {
                  const [ic, tone] = activityIcon(r.action, r.status);
                  const detail = r.details ? Object.entries(r.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
                  return `<tr>
                    <td>${esc(fmtDateTime(r.createdAt))}<div class="cell-sub">${esc(timeAgo(r.createdAt))}</div></td>
                    <td><div class="person"><div class="avatar" style="width:32px;height:32px;font-size:12px">${esc(initials(r.admin))}</div>${esc(r.admin)}</div></td>
                    <td><span class="stat-icon tone-${tone}" style="display:inline-flex;width:28px;height:28px;font-size:16px;vertical-align:middle;margin-right:8px">${icon(ic)}</span>${esc(ACTIVITY_LABEL[r.action] || r.action)}</td>
                    <td>${esc(r.target || '—')}${detail ? `<div class="cell-sub">${esc(detail)}</div>` : ''}</td>
                    <td class="cell-sub">${esc(r.machine || '—')}${r.localOnly ? ' <span class="badge badge-warn">local</span>' : ''}</td>
                    <td><span class="badge badge-${r.status === 'success' ? 'success' : 'failed'}">${r.status === 'success' ? 'Worked' : 'Failed'}</span></td>
                  </tr>`;
                })
                .join('')}</tbody></table></div>
              ${rows.length > 300 ? `<div class="pager"><span>Showing the latest 300 of ${rows.length}. Export to see all.</span></div>` : ''}`
            : `<div class="empty">${icon('user-list')}No activity matches.</div>`
        }
      </div>`;
    const search = $('#activity-search');
    search.addEventListener(
      'input',
      debounce(() => {
        activityState.query = search.value;
        drawActivity();
        const again = $('#activity-search');
        again.focus();
        again.setSelectionRange(again.value.length, again.value.length);
      }, 250)
    );
    [['admin', 'admin'], ['action', 'action'], ['status', 'status']].forEach(([id, key]) =>
      $(`#activity-${id}`).addEventListener('change', (e) => {
        activityState[key] = e.target.value;
        drawActivity();
      })
    );
  }

  function exportActivity() {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['When', 'Admin', 'Action', 'On', 'Detail', 'Computer', 'Result'].map(cell).join(',')];
    filteredActivity().forEach((r) =>
      lines.push([new Date(r.createdAt).toISOString(), r.admin, ACTIVITY_LABEL[r.action] || r.action, r.target, r.details ? JSON.stringify(r.details) : '', r.machine, r.status].map(cell).join(','))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chemstock-admin-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ============================================
  // ONE CLICK HANDLER FOR EVERYTHING
  // ============================================
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('.menu') && !e.target.closest('[data-action="key-menu"]')) closeMenu();

    const viewLink = e.target.closest('[data-view-link]');
    if (viewLink) {
      if (viewLink.dataset.viewLink === 'generate' && form.result) form = freshForm();
      return go(viewLink.dataset.viewLink);
    }
    const navBtn = e.target.closest('.nav-item[data-view]');
    if (navBtn) return go(navBtn.dataset.view);

    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;

    switch (action) {
      case 'logout': return logout();
      case 'close-drawer': return closeDrawer();
      // keys
      case 'use-email-suggestion': form.email = el.dataset.email; form.emailCheck = null; return drawGenerate();
      case 'branches-filter': branchesState.filter = el.dataset.filter; return drawBranches();
      case 'keys-filter': keysState.filter = el.dataset.filter; keysState.page = 1; return drawKeys();
      case 'keys-reveal': keysState.reveal = !keysState.reveal; if (keysState.reveal) logEvent('codes_revealed'); return drawKeys();
      case 'keys-page': keysState.page += Number(el.dataset.delta); return drawKeys();
      case 'key-copy': { const k = keysState.all.find((x) => x.id === id); if (k) logEvent('code_copied', `${k.managerName}`); return k && copyText(k.code, 'Code copied'); }
      case 'key-menu': e.stopPropagation(); return keyMenu(el, id);
      // generate
      case 'set-days': form.days = Number(el.dataset.days); return drawGenerate();
      case 'step-next': {
        if (form.step === 2) syncNewBranchFields();
        const problem = validateStep(form.step);
        if (problem) return toast(problem, 'error');
        form.step += 1;
        return drawGenerate();
      }
      case 'step-back': syncNewBranchFields(); form.step -= 1; return drawGenerate();
      case 'toggle-branch': {
        const b = allBranches.find((x) => x.id === id);
        if (el.checked) form.branches.push({ id: b.id, name: b.name, city: b.city });
        else form.branches = form.branches.filter((x) => x.id !== id);
        syncNewBranchFields();
        return drawGenerate();
      }
      case 'remove-branch': syncNewBranchFields(); form.branches.splice(Number(el.dataset.index), 1); return drawGenerate();
      case 'open-new-branch': newBranch = { name: '', city: '', region: '', address: '' }; form.similarWarning = null; return drawGenerate();
      case 'cancel-new-branch': newBranch = null; form.similarWarning = null; return drawGenerate();
      case 'add-new-branch': return addNewBranch();
      case 'pick-place': {
        const p = placeResults[Number(el.dataset.index)];
        syncNewBranchFields();
        newBranch = { ...newBranch, city: p.city, region: p.region, address: p.address, name: newBranch.name || (p.city ? `${p.city} Branch` : p.name) };
        drawGenerate();
        return;
      }
      case 'use-existing': {
        const match = allBranches.find((x) => x.id === id);
        if (match && !form.branches.some((b) => b.id === id)) form.branches.push({ id: match.id, name: match.name, city: match.city });
        newBranch = null;
        form.similarWarning = null;
        toast(`Using ${match ? match.name : 'existing branch'}`, 'success');
        return drawGenerate();
      }
      case 'create-anyway': {
        const ok = await confirmDialog({
          title: 'Create a separate branch?',
          message: 'Only do this if it is really a different place. Two branches with similar names confuse stock and reports.',
          confirmText: 'Create anyway',
          danger: true,
          iconName: 'warning',
        });
        if (!ok) return;
        syncNewBranchFields();
        newBranch.createAnyway = true;
        form.similarWarning = null;
        return addNewBranch();
      }
      case 'key-mode': form.keyMode = el.value; return drawGenerate();
      case 'new-suggestion': form.suggested = (await api('GET', '/api/keys/suggest')).code; return drawGenerate();
      case 'copy-suggestion': return copyText(form.suggested, 'Key copied');
      case 'generate': return generate();
      case 'copy-result': return copyText(form.result.code, 'Key copied');
      case 'qr-result': {
        try {
          const { dataUrl } = await api('GET', `/api/keys/${form.result.id}/qr`);
          $('#result-qr').innerHTML = `<img class="qr-img" src="${esc(dataUrl)}" alt="QR code of the activation key" />`;
        } catch (error) {
          toast(error.message, 'error');
        }
        return;
      }
      case 'generate-another': {
        form = freshForm();
        newBranch = null;
        branchQuery = '';
        return go('generate');
      }
      // managers
      case 'managers-filter': managersState.filter = el.dataset.filter; return drawManagers();
      case 'open-manager': return openManager(id);
      case 'manager-status': return setManagerStatus(id, el.dataset.active === 'true');
      case 'manager-branches': return editManagerBranches(id);
      case 'save-manager-branches': return saveManagerBranches(id);
      // branches
      case 'edit-branch': return editBranch(id);
      case 'save-branch': return saveBranch(id, el.dataset.anyway === 'true');
      case 'pick-place-edit': {
        const p = placeResults[Number(el.dataset.index)];
        $('#eb-city').value = p.city || '';
        $('#eb-region').value = p.region || '';
        $('#eb-address').value = p.address || '';
        $('#eb-results').innerHTML = '';
        return;
      }
      // audit
      case 'audit-export': logEvent('audit_exported'); return exportAudit();
      case 'activity-export': logEvent('activity_exported'); return exportActivity();
      case 'activity-refresh': return renderActivity();
      case 'audit-refresh': return renderAudit();
      default:
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      if (!$('#modal-root').innerHTML) closeDrawer();
    }
  });
  window.addEventListener('scroll', closeMenu, true);

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', async () => {
    $('#login-form').addEventListener('submit', submitLogin);
    try {
      const me = await api('GET', '/api/auth/me');
      if (me.loggedIn) startApp(me.adminName);
      else showLogin(me.configured === false ? 'No admin password set. Run: npm run set-password' : '');
    } catch (error) {
      showLogin(error.message);
    }
  });
})();
