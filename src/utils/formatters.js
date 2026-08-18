// src/utils/formatters.js

/**
 * "3h ago" / "2d ago" style relative time for activity logs.
 * Falls back to a plain locale date string once it's more than a week old,
 * since "9d ago" is less useful than an actual date at that point.
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '';

  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Days until a date (negative if already past). Returns null for a missing
 * date so callers can distinguish "no expiry set" from "expires today."
 */
export function daysUntil(dateString) {
  if (!dateString) return null;

  const target = new Date(dateString);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - now.getTime()) / 86400000);
}
