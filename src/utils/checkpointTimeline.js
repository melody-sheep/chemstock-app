// src/utils/checkpointTimeline.js

const toTime = (value) => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/**
 * The "Current Location" timeline for a delivery: the origin event (when the
 * collector's involvement began) followed by every logged checkpoint, oldest
 * first. Shared by the Manager, Sales Rep, and Collector views so all three
 * order and label events the same way. Only the origin label differs by role.
 *
 * @param {Object} options
 * @param {string} options.originLabel - e.g. 'Picked up by Collector' or 'Trip Started'
 * @param {string|null} options.originAt - ISO time of the origin event
 * @param {Array<{label: string, createdAt: string}>} options.checkpoints - in any order
 */
export function buildTimelineEntries({ originLabel, originAt, checkpoints = [] }) {
  const sorted = [...checkpoints].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));

  return [
    ...(originAt ? [{ key: 'origin', label: originLabel, createdAt: originAt }] : []),
    ...sorted.map((cp, index) => ({ key: `cp-${index}`, label: cp.label, createdAt: cp.createdAt })),
  ];
}
