// src/components/common/DashboardTour.js
// A short first-time tour of a dashboard: four highlights, one at a time (what needs attention, the quick
// stats, the main operations, the round button). It shows once per phone and role, after the dashboard has
// loaded and the welcome message is closed, and comes back with Settings -> Tips -> Show again.
import React, { useEffect, useState } from 'react';
import { findNodeHandle, useWindowDimensions } from 'react-native';
import PropTypes from 'prop-types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SpotlightHint from './SpotlightHint';
import { useBottomNavBarHeight } from './BottomNavBar';
import { useFirstTimeHint } from '../../hooks/useFirstTimeHint';

// Header (56) and the collapsing sub-header (108) cover the top of every dashboard.
const HEADERS_HEIGHT = 56 + 108;

const STEPS = {
  manager: [
    { target: 'focus', icon: 'notification', title: 'Needs attention', description: 'Stock requests, reports and discrepancies waiting for you show up here. Tap a row to open it.' },
    { target: 'stats', icon: 'grid', title: 'Quick stats', description: 'Your numbers at a glance. Tap a card to jump straight to that screen.' },
    { target: 'ops', icon: 'package', title: 'Main operations', description: 'Receive stock, release it to Sales Reps and Collectors, review returns, track deliveries and manage accounts.' },
    { target: 'fab', fixed: true, icon: 'qrCode', title: 'Scan a QR', description: 'Scan any ChemStock QR to receive, accept or verify stock in one tap.' },
  ],
  sales_rep: [
    { target: 'focus', icon: 'clock', title: 'Today', description: 'Your backpack, the daily report and anything to resolve. Tap a row to open it.' },
    { target: 'stats', icon: 'grid', title: 'Quick stats', description: 'Your numbers at a glance. Tap a card to jump straight to that screen.' },
    { target: 'ops', icon: 'package', title: 'Main operations', description: 'Receive stock, request more, submit your daily report, track deliveries and return what you did not sell.' },
    { target: 'fab', fixed: true, icon: 'qrCode', title: 'Scan a QR', description: 'Scan the QR your Manager or Collector shows you to receive stock.' },
  ],
  collector: [
    { target: 'focus', icon: 'notification', title: 'Needs attention', description: 'Pickups to accept, deliveries ready to go and trips in progress. Tap a row to open it.' },
    { target: 'stats', icon: 'grid', title: 'Quick stats', description: 'Pending, Ready and Active deliveries at a glance. Tap a card to open the list.' },
    { target: 'ops', icon: 'package', title: 'Main operations', description: 'Accept deliveries from your Manager and look back at what you delivered.' },
    { target: 'fab', fixed: true, icon: 'truck', title: 'Accept deliveries', description: 'This button opens Accept Deliveries. The number on it is what is waiting for you.' },
  ],
};

const measure = (node) =>
  new Promise((resolve) => {
    if (!node || !node.measureInWindow) return resolve(null);
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param role      'manager' | 'sales_rep' | 'collector'
 * @param refs      { focus, stats, ops, fab }: refs of the four highlighted views (collapsable={false})
 * @param enabled   true once the dashboard is loaded and no welcome message is open
 * @param scrollRef the dashboard's ScrollView, so a highlight below the fold can be scrolled into view
 */
export default function DashboardTour({ role, refs, enabled, scrollRef }) {
  const steps = STEPS[role] || [];
  const hint = useFirstTimeHint(`dashboard_tour_v1_${role}`);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const bottomNavHeight = useBottomNavBarHeight();
  const [index, setIndex] = useState(0);
  // The step on screen: its position is measured (and the page scrolled) before it is shown.
  const [shown, setShown] = useState(null);
  const active = enabled && hint.isVisible && steps.length > 0;

  const clearTop = insets.top + HEADERS_HEIGHT + 8;
  const clearBottom = windowHeight - bottomNavHeight - 16;

  const finish = () => {
    setShown(null);
    setIndex(0);
    hint.dismiss();
  };

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const advance = () => {
      if (index < steps.length - 1) setIndex(index + 1);
      else finish();
    };
    (async () => {
      const step = steps[index];
      const node = refs[step.target]?.current;
      let rect = await measure(node);
      if (cancelled) return;
      // An element that is not on this screen right now (nothing laid out) is skipped.
      if (!rect || rect.width === 0 || rect.height === 0) return advance();

      const scroller = scrollRef?.current;
      if (!step.fixed && scroller && (rect.y < clearTop || rect.y + rect.height > clearBottom)) {
        await new Promise((resolve) => {
          const relativeTo = scroller.getInnerViewRef?.() || findNodeHandle(scroller);
          node.measureLayout(
            relativeTo,
            (_x, contentY) => {
              scroller.measureInWindow((_sx, scrollerTop) => {
                scroller.scrollTo({ y: Math.max(contentY - (clearTop + 16 - scrollerTop), 0), animated: true });
                resolve();
              });
            },
            resolve
          );
        });
        await delay(450);
        if (cancelled) return;
        rect = await measure(node);
        if (!rect) return advance();
      }
      if (!cancelled) setShown({ index, rect });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index]);

  const step = shown ? steps[shown.index] : null;
  return (
    <SpotlightHint
      visible={active && !!shown}
      target={shown ? shown.rect : null}
      icon={step?.icon}
      title={step?.title}
      description={step?.description || ''}
      step={{ index: shown ? shown.index : 0, count: steps.length }}
      onNext={() => setIndex((i) => i + 1)}
      onSkip={finish}
      onDismiss={finish}
    />
  );
}

DashboardTour.propTypes = {
  role: PropTypes.oneOf(['manager', 'sales_rep', 'collector']).isRequired,
  refs: PropTypes.shape({
    focus: PropTypes.object,
    stats: PropTypes.object,
    ops: PropTypes.object,
    fab: PropTypes.object,
  }).isRequired,
  enabled: PropTypes.bool,
  scrollRef: PropTypes.object,
};
