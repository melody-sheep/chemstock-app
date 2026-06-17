/* ============================================ */
/* ADMIN CONSOLE SCRIPT                          */
/* ============================================ */

const API_URL = window.location.origin;
const TOAST_TIMEOUT = 3000;
let currentBranchCount = 1;
let keysBlurred = true;

/* ============================================ */
/* INIT                                          */
/* ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    console.log('◆ [Console] Initialized');
    updateTime();
    setInterval(updateTime, 1000);
    updateSidebarTime();
    setInterval(updateSidebarTime, 1000);
    loadStats();
    loadRecentKeys();
    loadAllKeys();
    setupNavigation();
    setupForm();
    setupKeyboardShortcuts();
    setupBlurToggle();
    generateBranchFields(1);
});

/* ============================================ */
/* TIME                                         */
/* ============================================ */
function updateTime() {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function updateSidebarTime() {
    const now = new Date();
    document.getElementById('sidebar-time').textContent = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/* ============================================ */
/* BRANCH MANAGEMENT                            */
/* ============================================ */
function adjustBranchCount(delta) {
    const input = document.getElementById('branchCount');
    let newValue = parseInt(input.value) + delta;
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    input.value = newValue;
    currentBranchCount = newValue;
    generateBranchFields(newValue);
    clearBranchErrors();
}

function generateBranchFields(count) {
    const container = document.getElementById('branch-fields');
    container.innerHTML = '';
    
    for (let i = 1; i <= count; i++) {
        const div = document.createElement('div');
        div.className = 'branch-field-item';
        div.dataset.branchIndex = i;
        div.innerHTML = `
            <span class="branch-number">BRANCH ${i}</span>
            <div class="form-group">
                <label for="branch-name-${i}">BRANCH NAME <span class="required">*</span></label>
                <input type="text" id="branch-name-${i}" placeholder="Enter branch name" data-branch="${i}" />
                <span class="error-text" id="branch-name-${i}-error"></span>
            </div>
            <div class="form-group">
                <label for="branch-location-${i}">BRANCH LOCATION</label>
                <input type="text" id="branch-location-${i}" placeholder="Enter branch location" data-branch="${i}" />
            </div>
        `;
        container.appendChild(div);
    }
}

function getBranchData() {
    const branches = [];
    const count = parseInt(document.getElementById('branchCount').value) || 1;
    
    for (let i = 1; i <= count; i++) {
        const nameInput = document.getElementById(`branch-name-${i}`);
        const locationInput = document.getElementById(`branch-location-${i}`);
        
        if (nameInput) {
            const name = nameInput.value.trim();
            if (name) {
                branches.push({
                    name: name.toUpperCase(),
                    location: locationInput ? locationInput.value.trim().toUpperCase() : ''
                });
            }
        }
    }
    return branches;
}

/* ============================================ */
/* FORM VALIDATION                              */
/* ============================================ */
function validateForm() {
    let isValid = true;
    
    // Clear all previous errors
    clearAllErrors();
    
    // Validate Manager Name
    const managerName = document.getElementById('managerName');
    if (!managerName.value.trim()) {
        markError(managerName, 'managerName-error', 'Full name is required');
        isValid = false;
    }
    
    // Validate Manager Email
    const managerEmail = document.getElementById('managerEmail');
    if (!managerEmail.value.trim()) {
        markError(managerEmail, 'managerEmail-error', 'Email address is required');
        isValid = false;
    } else if (!isValidEmail(managerEmail.value.trim())) {
        markError(managerEmail, 'managerEmail-error', 'Please enter a valid email address');
        isValid = false;
    }
    
    // Validate Branches
    const branchCount = parseInt(document.getElementById('branchCount').value) || 1;
    let hasBranchError = false;
    
    for (let i = 1; i <= branchCount; i++) {
        const nameInput = document.getElementById(`branch-name-${i}`);
        if (nameInput && !nameInput.value.trim()) {
            const fieldItem = nameInput.closest('.branch-field-item');
            if (fieldItem) {
                fieldItem.classList.add('has-error');
                const errorEl = document.getElementById(`branch-name-${i}-error`);
                if (errorEl) {
                    errorEl.textContent = 'Branch name is required';
                    errorEl.classList.add('show');
                }
            }
            hasBranchError = true;
            isValid = false;
        }
    }
    
    if (hasBranchError) {
        document.querySelector('.branch-control').classList.add('has-error');
        document.getElementById('branch-error').textContent = 'Please fill in all branch names';
        document.getElementById('branch-error').classList.add('show');
    }
    
    return isValid;
}

function clearAllErrors() {
    // Clear form group errors
    document.querySelectorAll('.form-group.has-error').forEach(el => el.classList.remove('has-error'));
    document.querySelectorAll('.branch-field-item.has-error').forEach(el => el.classList.remove('has-error'));
    document.querySelector('.branch-control')?.classList.remove('has-error');
    
    // Clear error texts
    document.querySelectorAll('.error-text').forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
}

function clearBranchErrors() {
    document.querySelectorAll('.branch-field-item.has-error').forEach(el => el.classList.remove('has-error'));
    document.querySelector('.branch-control')?.classList.remove('has-error');
    document.getElementById('branch-error')?.classList.remove('show');
    document.getElementById('branch-error').textContent = '';
}

function markError(input, errorId, message) {
    const formGroup = input.closest('.form-group');
    if (formGroup) formGroup.classList.add('has-error');
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ============================================ */
/* BLUR TOGGLE FOR ACTIVATION KEYS              */
/* ============================================ */
function setupBlurToggle() {
    applyBlurState();
}

function toggleBlur() {
    keysBlurred = !keysBlurred;
    applyBlurState();
    
    const labels = document.querySelectorAll('#blur-toggle-label, #blur-toggle-label-keys');
    labels.forEach(label => {
        label.textContent = keysBlurred ? 'SHOW' : 'HIDE';
    });
    
    showToast(keysBlurred ? 'Keys hidden' : 'Keys visible', 'success');
}

function applyBlurState() {
    const codes = document.querySelectorAll('#all-keys-body code, #recent-keys-body code');
    codes.forEach(code => {
        if (keysBlurred) {
            code.classList.add('blurred-code');
        } else {
            code.classList.remove('blurred-code');
        }
    });
}

/* ============================================ */
/* NAVIGATION                                   */
/* ============================================ */
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.dataset.view);
        });
    });
}

function switchView(view) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');

    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');

    const titles = {
        dashboard: 'DASHBOARD',
        keys: 'ACTIVATION KEYS',
        generate: 'GENERATE KEY'
    };
    const subtitles = {
        dashboard: 'SYSTEM OVERVIEW',
        keys: 'RECORD MANAGEMENT',
        generate: 'CREATE NEW RECORD'
    };
    document.getElementById('page-title').textContent = titles[view] || 'DASHBOARD';
    document.querySelector('.page-subtitle').textContent = subtitles[view] || 'SYSTEM OVERVIEW';

    if (view === 'dashboard') { loadStats(); loadRecentKeys(); }
    if (view === 'keys') { loadAllKeys(); }
}

/* ============================================ */
/* STATS                                        */
/* ============================================ */
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/api/stats`);
        const result = await response.json();

        if (result.success) {
            document.getElementById('stat-total').textContent = result.data.total || 0;
            document.getElementById('stat-available').textContent = result.data.available || 0;
            document.getElementById('stat-used').textContent = result.data.used || 0;
            document.getElementById('stat-expired').textContent = result.data.expired || 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/* ============================================ */
/* KEYS                                         */
/* ============================================ */
async function loadRecentKeys() {
    try {
        const response = await fetch(`${API_URL}/api/keys`);
        const result = await response.json();
        const tbody = document.getElementById('recent-keys-body');

        if (!result.success || !result.data || result.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="loading-text">NO RECORDS FOUND</td></tr>`;
            return;
        }

        const keys = result.data.slice(0, 5);
        tbody.innerHTML = keys.map(key => `
            <tr>
                <td><code class="${keysBlurred ? 'blurred-code' : ''}">${escapeHtml(key.code)}</code></td>
                <td>${escapeHtml(key.manager_name)}</td>
                <td>${escapeHtml(key.branch_names?.join(', ') || 'N/A')}</td>
                <td>${getStatusBadge(key)}</td>
                <td>${formatDate(key.expires_at)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading recent keys:', error);
    }
}

async function loadAllKeys() {
    try {
        const response = await fetch(`${API_URL}/api/keys`);
        const result = await response.json();
        const tbody = document.getElementById('all-keys-body');

        if (!result.success || !result.data || result.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="loading-text">NO RECORDS FOUND</td></tr>`;
            return;
        }

        tbody.innerHTML = result.data.map(key => `
            <tr>
                <td><code class="${keysBlurred ? 'blurred-code' : ''}">${escapeHtml(key.code)}</code></td>
                <td>${escapeHtml(key.manager_name)}</td>
                <td>${escapeHtml(key.manager_email)}</td>
                <td>${escapeHtml(key.branch_names?.join(', ') || 'N/A')}</td>
                <td>${getStatusBadge(key)}</td>
                <td>${formatDate(key.expires_at)}</td>
                <td style="text-align:center;">
                    <button class="btn btn-danger btn-sm" onclick="revokeKey('${escapeHtml(key.code)}')" ${key.is_used ? 'disabled' : ''}>
                        REVOKE
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading all keys:', error);
    }
}

/* ============================================ */
/* STATUS BADGE                                 */
/* ============================================ */
function getStatusBadge(key) {
    if (key.is_used) {
        return `<span class="badge badge-used">● USED</span>`;
    }
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
        return `<span class="badge badge-expired">● EXPIRED</span>`;
    }
    return `<span class="badge badge-available">● AVAILABLE</span>`;
}

/* ============================================ */
/* HELPERS                                      */
/* ============================================ */
function formatDate(dateStr) {
    if (!dateStr) return 'NEVER';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }).toUpperCase();
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ============================================ */
/* GENERATE KEY FORM                           */
/* ============================================ */
function setupForm() {
    document.getElementById('generate-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (validateForm()) {
            await generateKey();
        } else {
            showToast('Please fill in all required fields', 'error');
            // Scroll to first error
            const firstError = document.querySelector('.form-group.has-error, .branch-field-item.has-error');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
}

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 16; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('code').value = code;
    showToast('Random code generated', 'success');
}

async function generateKey() {
    const code = document.getElementById('code').value.trim() || null;
    const managerName = document.getElementById('managerName').value.trim().toUpperCase();
    const managerEmail = document.getElementById('managerEmail').value.trim();
    const branches = getBranchData();
    const branchNames = branches.map(b => b.name);
    const branchLocations = branches.map(b => b.location);
    const daysValid = parseInt(document.getElementById('daysValid').value) || 30;
    const generatePassword = document.getElementById('generatePassword').checked;

    try {
        const response = await fetch(`${API_URL}/api/keys/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                managerName,
                managerEmail,
                branchNames,
                branchLocations,
                daysValid,
                generatePassword
            })
        });

        const result = await response.json();

        if (result.success) {
            const resultDiv = document.getElementById('generation-result');
            resultDiv.style.display = 'block';

            document.getElementById('result-code').textContent = result.data.code;
            document.getElementById('result-manager').textContent = result.data.manager_name.toUpperCase();
            document.getElementById('result-email').textContent = result.data.manager_email;
            document.getElementById('result-branches').textContent = result.data.branch_names.join(', ');
            document.getElementById('result-expires').textContent = formatDate(result.data.expires_at);

            const passwordContainer = document.getElementById('result-password-container');
            const passwordBtn = document.getElementById('copy-password-btn');
            
            if (result.data.generatedPassword) {
                passwordContainer.style.display = 'block';
                document.getElementById('result-password').textContent = result.data.generatedPassword;
                passwordBtn.style.display = 'inline-flex';
            } else {
                passwordContainer.style.display = 'none';
                passwordBtn.style.display = 'none';
            }

            showToast('Key generated successfully', 'success');
            loadStats();
            loadRecentKeys();

            // Reset form but keep code field empty
            resetForm();

            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            showToast(`Error: ${result.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error generating key:', error);
        showToast('Failed to generate key', 'error');
    }
}

function resetForm() {
    document.getElementById('generate-form').reset();
    document.getElementById('code').value = '';
    document.getElementById('branchCount').value = '1';
    currentBranchCount = 1;
    generateBranchFields(1);
    clearAllErrors();
    document.getElementById('generation-result').style.display = 'none';
}

/* ============================================ */
/* REVOKE KEY                                   */
/* ============================================ */
async function revokeKey(code) {
    if (!confirm(`REVOKE KEY "${code}"?`)) return;

    try {
        const response = await fetch(`${API_URL}/api/keys/${encodeURIComponent(code)}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast(`Key "${code}" revoked`, 'success');
            loadAllKeys();
            loadStats();
            loadRecentKeys();
        } else {
            showToast(`Error: ${result.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error revoking key:', error);
        showToast('Failed to revoke key', 'error');
    }
}

/* ============================================ */
/* COPY FUNCTIONS                               */
/* ============================================ */
function copyResult() {
    const code = document.getElementById('result-code').textContent;
    if (!code || code === '-') return;
    copyToClipboard(code, 'Code copied to clipboard');
}

function copyPassword() {
    const password = document.getElementById('result-password').textContent;
    if (!password || password === '-') return;
    copyToClipboard(password, 'Password copied to clipboard');
}

function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage, 'success');
        }).catch(() => {
            fallbackCopy(text, successMessage);
        });
    } else {
        fallbackCopy(text, successMessage);
    }
}

function fallbackCopy(text, successMessage) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast(successMessage, 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textarea);
}

/* ============================================ */
/* TOAST                                        */
/* ============================================ */
let toastTimeout = null;

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toast-message');

    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    toast.classList.remove('success', 'error', 'show');

    messageEl.textContent = message;

    if (type === 'success') toast.classList.add('success');
    if (type === 'error') toast.classList.add('error');

    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, TOAST_TIMEOUT);
}

/* ============================================ */
/* KEYBOARD SHORTCUTS                           */
/* ============================================ */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '1') { e.preventDefault(); switchView('dashboard'); }
        if (e.ctrlKey && e.key === '2') { e.preventDefault(); switchView('keys'); }
        if (e.ctrlKey && e.key === '3') { e.preventDefault(); switchView('generate'); }
        if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggleBlur(); }
        if (e.key === 'Escape') {
            document.getElementById('toast').classList.remove('show');
        }
    });
}