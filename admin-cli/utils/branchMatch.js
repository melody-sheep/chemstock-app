// admin-cli/utils/branchMatch.js
// Finds existing branches that are probably the same place as a typed name,
// so the admin is warned before creating a duplicate. Ignores capitals,
// punctuation and the word "branch"; also catches close spellings
// ("Iponan" / "Ipponan") and initials ("CDO" = "Cagayan de Oro").

const STOP_WORDS = new Set(['BRANCH', 'BR', 'OFFICE', 'THE', 'OF']);

function words(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
}

const normalize = (name) => words(name).join('');
const initials = (name) => words(name).map((w) => w[0]).join('');

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

/** Why `existing` looks like `typed`, or null if it doesn't. */
function matchReason(typed, existing) {
  const a = normalize(typed);
  const b = normalize(existing);
  if (!a || !b) return null;
  if (a === b) return 'Same name';
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 'Very similar name';
  const longest = Math.max(a.length, b.length);
  if (longest >= 5 && distance(a, b) <= (longest >= 10 ? 2 : 1)) return 'Similar spelling';
  if (a.length >= 2 && a.length <= 5 && a === initials(existing)) return 'Initials match';
  if (b.length >= 2 && b.length <= 5 && b === initials(typed)) return 'Initials match';
  return null;
}

/** Existing branches that look like `name`, most certain first. */
function findSimilar(name, branches, excludeId = null) {
  const order = ['Same name', 'Very similar name', 'Similar spelling', 'Initials match'];
  return branches
    .filter((b) => b.id !== excludeId)
    .map((b) => ({ ...b, reason: matchReason(name, b.name) }))
    .filter((b) => b.reason)
    .sort((x, y) => order.indexOf(x.reason) - order.indexOf(y.reason));
}

module.exports = { findSimilar, normalize };
