// src/utils/branchLabel.js

// Short branch text for the dashboard header, sized to how many branches there are:
//   1 branch   -> the full name, cut at 12 letters ("Casterly Roc...")
//   2 branches -> 6 letters each ("Kings ..., Winter...")
//   3 branches -> 3 letters each ("Kin..., Win..., Cas...")
//   4+ branches -> 2 letters each
const SINGLE_BRANCH_CHARS = 12;
const CHARS_BY_COUNT = { 2: 6, 3: 3 };
const MANY_BRANCHES_CHARS = 2;

const toTitleCase = (text) => text.replace(/\b\w/g, (letter) => letter.toUpperCase());

export function formatBranchLabel(branchName) {
  const parts = String(branchName || '')
    .split(',')
    .map((part) => part.trim().replace(/\s*branch$/i, '').toLowerCase())
    .filter(Boolean)
    .map(toTitleCase);

  if (parts.length === 0) return '';

  const limit = parts.length === 1 ? SINGLE_BRANCH_CHARS : CHARS_BY_COUNT[parts.length] || MANY_BRANCHES_CHARS;
  return parts
    .map((name) => (name.length > limit ? `${name.slice(0, limit).trimEnd()}...` : name))
    .join(', ');
}
