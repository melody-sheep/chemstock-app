// src/hooks/useScrolledToEnd.js
import { useCallback, useRef, useState } from 'react';

/**
 * Tracks whether the user has scrolled a ScrollView all the way to the
 * bottom at least once — for gating a "review everything before
 * submitting" action button so it can't be pressed before the user has
 * actually seen the rest of the screen. Once reached it stays true even if
 * they scroll back up. If the content is short enough that it never needs
 * to scroll, counts as reached immediately — there's nothing more to see.
 *
 * Spread the returned handlers onto the ScrollView: onScroll, onLayout,
 * onContentSizeChange (plus scrollEventThrottle, which ScrollView needs
 * regardless for onScroll to fire at a usable rate).
 */
export default function useScrolledToEnd(thresholdPx = 24) {
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);

  const checkFits = () => {
    if (
      viewportHeight.current > 0 &&
      contentHeight.current > 0 &&
      contentHeight.current <= viewportHeight.current
    ) {
      setHasReachedEnd(true);
    }
  };

  const onScroll = useCallback(
    (event) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
      if (distanceFromBottom <= thresholdPx) {
        setHasReachedEnd(true);
      }
    },
    [thresholdPx]
  );

  const onContentSizeChange = useCallback((_width, height) => {
    contentHeight.current = height;
    checkFits();
  }, []);

  const onLayout = useCallback((event) => {
    viewportHeight.current = event.nativeEvent.layout.height;
    checkFits();
  }, []);

  return { hasReachedEnd, onScroll, onContentSizeChange, onLayout };
}
