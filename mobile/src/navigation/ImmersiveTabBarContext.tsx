import { useFocusEffect } from "@react-navigation/native";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout, spacing } from "../theme/tokens";

type ImmersiveTabBarContextValue = {
  hidden: boolean;
  setHidden: (next: boolean) => void;
};

const ImmersiveTabBarContext = createContext<ImmersiveTabBarContextValue | null>(null);

export function ImmersiveTabBarProvider({ children }: PropsWithChildren) {
  const [hidden, setHiddenState] = useState(false);

  const setHidden = useCallback((next: boolean) => {
    setHiddenState((current) => (current === next ? current : next));
  }, []);

  const value = useMemo(
    () => ({
      hidden,
      setHidden
    }),
    [hidden, setHidden]
  );

  return <ImmersiveTabBarContext.Provider value={value}>{children}</ImmersiveTabBarContext.Provider>;
}

export function useImmersiveTabBar() {
  const context = useContext(ImmersiveTabBarContext);
  const insets = useSafeAreaInsets();

  if (!context) {
    throw new Error("useImmersiveTabBar must be used within ImmersiveTabBarProvider.");
  }

  return {
    ...context,
    bottomInset: layout.tabBarHeight + Math.max(insets.bottom, spacing.md) + spacing.lg
  };
}

export function useImmersiveTabBarScroll() {
  const { bottomInset, setHidden } = useImmersiveTabBar();
  const lastOffsetRef = useRef(0);
  const draggingRef = useRef(false);
  const directionRef = useRef<"up" | "down" | null>(null);
  const travelRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      lastOffsetRef.current = 0;
      draggingRef.current = false;
      directionRef.current = null;
      travelRef.current = 0;
      setHidden(false);

      return () => {
        lastOffsetRef.current = 0;
        draggingRef.current = false;
        directionRef.current = null;
        travelRef.current = 0;
        setHidden(false);
      };
    }, [setHidden])
  );

  const onScrollBeginDrag = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    draggingRef.current = true;
    directionRef.current = null;
    travelRef.current = 0;
    lastOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
  }, []);

  const onScrollEndDrag = useCallback(() => {
    draggingRef.current = false;
    directionRef.current = null;
    travelRef.current = 0;
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!draggingRef.current) {
        return;
      }

      const offsetY = Math.max(0, event.nativeEvent.contentOffset.y);
      const delta = offsetY - lastOffsetRef.current;
      const nextDirection = delta > 0 ? "down" : delta < 0 ? "up" : directionRef.current;

      if (offsetY <= 16) {
        setHidden(false);
        directionRef.current = null;
        travelRef.current = 0;
        lastOffsetRef.current = offsetY;
        return;
      }

      if (nextDirection && nextDirection !== directionRef.current) {
        directionRef.current = nextDirection;
        travelRef.current = Math.abs(delta);
      } else {
        travelRef.current += Math.abs(delta);
      }

      if (nextDirection === "down" && offsetY > 88 && travelRef.current >= 54) {
        setHidden(true);
        travelRef.current = 0;
      } else if (nextDirection === "up" && travelRef.current >= 28) {
        setHidden(false);
        travelRef.current = 0;
      }

      lastOffsetRef.current = offsetY;
    },
    [setHidden]
  );

  return {
    bottomInset,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    scrollEventThrottle: 16 as const
  };
}
