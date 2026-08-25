// src/hooks/useFirstTimeHint.js
import { useEffect, useState } from 'react';
import { storage } from '../utils/storage';

const SEEN_HINTS_KEY = 'chemstock_seen_hints';

/**
 * Tracks whether a named onboarding-style tip has already been dismissed on
 * this device (AsyncStorage via the shared storage wrapper), so it only
 * ever shows once instead of nagging on every visit. Pass any stable,
 * unique `hintKey` per tip — pair with HintBanner for the presentational
 * side.
 */
export function useFirstTimeHint(hintKey) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const seenHints = (await storage.get(SEEN_HINTS_KEY)) || {};
      if (isMounted && !seenHints[hintKey]) {
        setIsVisible(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [hintKey]);

  const dismiss = async () => {
    setIsVisible(false);
    const seenHints = (await storage.get(SEEN_HINTS_KEY)) || {};
    seenHints[hintKey] = true;
    await storage.set(SEEN_HINTS_KEY, seenHints);
  };

  return { isVisible, dismiss };
}

export default useFirstTimeHint;
