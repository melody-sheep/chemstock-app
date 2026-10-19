// src/hooks/useKeyboardInset.js
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, TextInput } from 'react-native';
import { logKeyboardMeasure } from '../utils/keyboardDebug';

// Expo SDK 57 builds force Android edge-to-edge, where the screen is no
// longer shrunk for the keyboard (softwareKeyboardLayoutMode "resize" is
// ignored); Expo Go still shrinks it. So the space to make is measured, never
// assumed: the part of the given view that the keyboard actually covers,
// read after the keyboard has settled. 0 where the screen already shrank, the
// covered height where it didn't — right on any phone, keyboard or build.
const SETTLE_MS = 120;

/**
 * @param {React.RefObject} [viewRef] — the view to keep clear of the
 *   keyboard (a full-height container, not something the inset itself
 *   moves). Without one, the whole window is used.
 * @returns {{ inset: number, keyboardTop: number|null, isVisible: boolean }}
 */
export default function useKeyboardInset(viewRef) {
  const [state, setState] = useState({ inset: 0, keyboardTop: null, isVisible: false });
  const timer = useRef(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const keyboardTop = event.endCoordinates.screenY;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const node = viewRef?.current;
        const apply = (bottom) => {
          const inset = Math.max(0, Math.round(bottom - keyboardTop));
          logKeyboardMeasure(node ? 'view' : 'window', { viewBottom: Math.round(bottom), keyboardTop: Math.round(keyboardTop), inset });
          setState({ inset, keyboardTop, isVisible: true });
        };
        // A view was asked for but isn't on screen (e.g. a closed popup): nothing to keep clear.
        if (viewRef && !node) return;
        if (node?.measureInWindow) {
          node.measureInWindow((x, y, width, height) => apply(y + height));
        } else {
          apply(Dimensions.get('window').height);
        }
      }, SETTLE_MS);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      clearTimeout(timer.current);
      setState({ inset: 0, keyboardTop: null, isVisible: false });
    });
    return () => {
      clearTimeout(timer.current);
      show.remove();
      hide.remove();
    };
  }, [viewRef]);

  return state;
}

const FOCUS_MARGIN = 24;

/**
 * Scrolls `scrollRef` just enough for the focused text field to sit above
 * the keyboard. `scrollY` is the scroll view's current offset.
 */
export function scrollFocusedIntoView(scrollRef, scrollY, keyboardTop) {
  const input = TextInput.State.currentlyFocusedInput?.();
  if (!input || !scrollRef?.current || keyboardTop == null) return;
  input.measureInWindow?.((x, y, width, height) => {
    const overlap = y + height + FOCUS_MARGIN - keyboardTop;
    if (overlap > 0) {
      scrollRef.current.scrollTo({ y: Math.max(0, scrollY + overlap), animated: true });
    }
  });
}
