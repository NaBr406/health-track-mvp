import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Keyboard, Platform, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from "react-native";
import { spacing } from "../theme/tokens";

export function useScrollFocusedInputIntoView(scrollRef: RefObject<ScrollView | null>) {
  const keyboardTopRef = useRef<number | null>(null);
  const scrollOffsetRef = useRef(0);

  const scrollFocusedInputIntoView = useCallback(
    (keyboardTop: number) => {
      const focusedInput = TextInput.State.currentlyFocusedInput?.();

      if (!focusedInput || !scrollRef.current) {
        return;
      }

      focusedInput.measureInWindow((_x, y, _width, height) => {
        const overlap = y + height + spacing.xl - keyboardTop;

        if (overlap <= 0) {
          return;
        }

        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + overlap),
          animated: true
        });
      });
    },
    [scrollRef]
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const onFieldFocus = useCallback(() => {
    if (keyboardTopRef.current == null) {
      return;
    }

    requestAnimationFrame(() => {
      if (keyboardTopRef.current != null) {
        scrollFocusedInputIntoView(keyboardTopRef.current);
      }
    });
  }, [scrollFocusedInputIntoView]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;

      requestAnimationFrame(() => {
        scrollFocusedInputIntoView(event.endCoordinates.screenY);
      });
    });

    const hideSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      keyboardTopRef.current = null;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollFocusedInputIntoView]);

  return {
    onFieldFocus,
    onScroll,
    scrollEventThrottle: 16 as const
  };
}
