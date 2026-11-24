// src/constants/inventory.js
// Business rules for classifying stock on the Manager Stocks screen.
// A batch is "healthy" at STOCK_HEALTHY_THRESHOLD units or more; below that
// it's "almost out." A batch expiring within NEAR_EXPIRY_DAYS (or already
// past its exp_date) is flagged urgent. Both are simple thresholds for now —
// revisit if the team wants per-product thresholds later.
export const STOCK_HEALTHY_THRESHOLD = 20;
export const NEAR_EXPIRY_DAYS = 30;
// A batch this close to expiry is flagged red to the Sales Rep before they
// request it, and the Manager confirms before releasing it to the field.
export const CRITICAL_EXPIRY_DAYS = 7;

/** "today", "1 day left", "16 days left" — or null when there's no date. */
export const daysLeftLabel = (daysLeft) => {
  if (daysLeft === null || daysLeft === undefined) return null;
  if (daysLeft <= 0) return 'expires today';
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
};
// A stock section shows a "View all" link once it has at least this many cards.
export const VIEW_ALL_MIN_COUNT = 3;
