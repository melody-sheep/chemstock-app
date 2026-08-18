// src/constants/inventory.js
// Business rules for classifying stock on the Manager Stocks screen.
// A batch is "healthy" at STOCK_HEALTHY_THRESHOLD units or more; below that
// it's "almost out." A batch expiring within NEAR_EXPIRY_DAYS (or already
// past its exp_date) is flagged urgent. Both are simple thresholds for now —
// revisit if the team wants per-product thresholds later.
export const STOCK_HEALTHY_THRESHOLD = 50;
export const NEAR_EXPIRY_DAYS = 30;
