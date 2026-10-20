// admin-cli/utils/keyStrength.js
// How strong an activation code is — the same rules on the server (which
// refuses weak codes) and in the browser (which shows the live checklist).
// Loaded by Node with require() and by the page as /shared/keyStrength.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeyStrength = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var COMMON = [
    'password', 'passw0rd', 'pass', 'qwerty', 'admin', 'letmein', 'welcome', 'chemstock', 'manager',
    'activation', 'secret', 'iloveyou', 'abc123', 'test', 'demo', 'nigaw', 'akonanigaw', 'monkey', 'dragon'
  ];
  var SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm'];

  function hasSequence(code) {
    var lower = code.toLowerCase();
    for (var s = 0; s < SEQUENCES.length; s++) {
      var seq = SEQUENCES[s];
      var rev = seq.split('').reverse().join('');
      for (var i = 0; i + 4 <= seq.length; i++) {
        if (lower.indexOf(seq.slice(i, i + 4)) !== -1 || lower.indexOf(rev.slice(i, i + 4)) !== -1) return true;
      }
    }
    return /(.)\1\1/.test(code); // aaa, 111
  }

  function personalParts(context) {
    var parts = [];
    var push = function (text) {
      String(text || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .forEach(function (p) { if (p.length >= 4) parts.push(p); });
    };
    if (context) {
      push(context.name);
      push(String(context.email || '').split('@')[0]);
      (context.branches || []).forEach(push);
    }
    return parts;
  }

  /**
   * @param {string} code
   * @param {{name?: string, email?: string, branches?: string[]}} [context]
   * @returns {{ score: number, level: 'empty'|'weak'|'medium'|'strong'|'very_strong', label: string, checks: Array<{id:string,label:string,ok:boolean}>, allowed: boolean, needsConfirm: boolean }}
   */
  function check(code, context) {
    code = String(code || '');
    var lower = code.toLowerCase();
    var personal = personalParts(context);
    var checks = [
      { id: 'length', label: '12+ characters', ok: code.length >= 12 },
      { id: 'upper', label: 'A–Z', ok: /[A-Z]/.test(code) },
      { id: 'lower', label: 'a–z', ok: /[a-z]/.test(code) },
      { id: 'digit', label: '0–9', ok: /[0-9]/.test(code) },
      { id: 'charset', label: 'Letters and numbers only', ok: code.length > 0 && /^[A-Za-z0-9]+$/.test(code) },
      {
        id: 'common',
        label: 'No common word or sequence',
        ok: code.length > 0 && !hasSequence(code) && !COMMON.some(function (w) { return lower.indexOf(w) !== -1; })
      },
      {
        id: 'personal',
        label: 'Not guessable from the name, email or branch',
        ok: code.length > 0 && !personal.some(function (p) { return lower.indexOf(p) !== -1; })
      }
    ];
    if (!code) {
      return { score: 0, level: 'empty', label: '', checks: checks, allowed: false, needsConfirm: false };
    }
    var passed = checks.filter(function (c) { return c.ok; }).length;
    var mustPass = ['length', 'charset', 'common', 'personal'];
    var hardFail = checks.some(function (c) { return mustPass.indexOf(c.id) !== -1 && !c.ok; });
    var level;
    if (hardFail || passed <= 4) level = 'weak';
    else if (passed === 5 || code.length < 14) level = 'medium';
    else if (passed === 6 || code.length < 16) level = 'strong';
    else level = 'very_strong';
    var labels = { weak: 'Weak', medium: 'Medium', strong: 'Strong', very_strong: 'Very strong' };
    return {
      score: Math.round((passed / checks.length) * 100),
      level: level,
      label: labels[level],
      checks: checks,
      allowed: level !== 'weak',
      needsConfirm: level === 'medium'
    };
  }

  return { check: check };
});
