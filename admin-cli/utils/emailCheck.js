// admin-cli/utils/emailCheck.js
// Decides whether a manager's email looks like a real, working mailbox, without sending anything or asking
// anyone to confirm. It cannot prove who owns the address (only a confirmation mail can), but it stops
// typos, made-up domains, throw-away inboxes and impossible Gmail names.
const dns = require('dns').promises;

// Domains used for one-time inboxes. Not complete; the domain/MX check below catches the rest.
const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', '10minutemail.com',
  '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'throwawaymail.com', 'yopmail.com', 'yopmail.net',
  'trashmail.com', 'getnada.com', 'nada.email', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'mailnesia.com',
  'mintemail.com', 'mohmal.com', 'emailondeck.com', 'moakt.com', 'tempail.com', 'tmpmail.org', 'burnermail.io',
  'spamgourmet.com', 'mytemp.email', 'inboxkitten.com', 'mail.tm', 'discard.email', 'tempr.email', 'fakemail.net',
  'example.com', 'example.org', 'example.net', 'test.com', 'test.test',
]);

// Big providers that managers are likely to use. Used to spot typos like "gmial.com".
const POPULAR = ['gmail.com', 'yahoo.com', 'yahoo.com.ph', 'outlook.com', 'hotmail.com', 'icloud.com', 'live.com', 'proton.me', 'protonmail.com'];

const distance = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
};

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), ms))]);

// true = the domain can receive mail, false = it cannot, null = could not find out (no internet / DNS down)
async function domainReceivesMail(domain) {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), 4000);
    if (mx.length) return !(mx.length === 1 && mx[0].exchange === '');
  } catch (error) {
    if (error.code === 'ETIMEOUT' || error.code === 'ECONNREFUSED' || error.code === 'ESERVFAIL' || error.code === 'EAI_AGAIN') return null;
    if (error.code !== 'ENODATA' && error.code !== 'ENOTFOUND') return null;
  }
  // No MX record: mail servers fall back to the domain's own address.
  try {
    const addresses = await withTimeout(dns.resolve4(domain), 4000);
    return addresses.length > 0;
  } catch (error) {
    return error.code === 'ENODATA' || error.code === 'ENOTFOUND' ? false : null;
  }
}

/**
 * @returns {Promise<{ legit: boolean, reason?: string, message?: string, suggestion?: string, unchecked?: boolean }>}
 */
async function checkEmailLegit(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  const [local, domain, ...extra] = email.split('@');
  if (!local || !domain || extra.length || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || domain.includes('..')) {
    return { legit: false, reason: 'format', message: 'That is not a valid email address.' };
  }

  if (DISPOSABLE.has(domain)) {
    return { legit: false, reason: 'disposable', message: `${domain} is a throw-away or test mail service. Use the manager’s real email.` };
  }

  // A typo of a big provider, e.g. gmial.com, gmail.con, yaho.com
  if (!POPULAR.includes(domain)) {
    const near = POPULAR.find((p) => distance(domain, p) <= 1 || (p === 'gmail.com' && distance(domain, p) <= 2 && domain.startsWith('g')));
    if (near) {
      return { legit: false, reason: 'typo', message: `Did you mean ${local}@${near}?`, suggestion: `${local}@${near}` };
    }
  }

  // Gmail names have fixed rules, so many made-up ones can be rejected without any lookup.
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const name = local.split('+')[0];
    const ok = /^[a-z0-9.]{6,30}$/.test(name) && !name.startsWith('.') && !name.endsWith('.') && !name.includes('..');
    if (!ok) {
      return { legit: false, reason: 'gmail-name', message: 'That Gmail name cannot exist: Gmail names are 6–30 letters, numbers or dots.' };
    }
  }

  const receives = await domainReceivesMail(domain);
  if (receives === false) {
    return { legit: false, reason: 'no-mail', message: `${domain} does not accept email. Check the spelling after the @.` };
  }
  // DNS could not be reached (admin PC offline): do not block the work, the other checks already passed.
  if (receives === null) return { legit: true, unchecked: true };
  return { legit: true };
}

module.exports = { checkEmailLegit };
