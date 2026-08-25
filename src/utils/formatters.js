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

/**
 * MM/DD/YYYY display for a stored ISO date string (YYYY-MM-DD), or null when
 * unset/unparsable so callers can show their own "Set date" placeholder.
 */
export function formatDisplayDate(isoValue) {
  if (!isoValue) return null;
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/**
 * "14.5995°N, 120.9842°E" style GPS display — hemisphere letters derived
 * from the actual sign rather than hardcoded, so this stays correct even
 * outside the Philippines (positive latitude/longitude is N/E, negative
 * is S/W).
 */
export function formatCoordinates(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  const latLabel = latitude >= 0 ? 'N' : 'S';
  const lngLabel = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}°${latLabel}, ${Math.abs(longitude).toFixed(4)}°${lngLabel}`;
}

/**
 * "May 20, 2024 | 02:30 PM" style timestamp for transaction/proof records.
 */
export function formatDateTime(date) {
  if (!date) return null;
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart} | ${timePart}`;
}
