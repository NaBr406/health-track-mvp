import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Keyboard, Platform } from "react-native";
import { spacing } from "../../../theme/tokens";

type UseChatComposerLiftParams = {
  bottomInset: number;
  hidden: boolean;
  insetsBottom: number;
  scrollToBottom: (animated?: boolean) => void;
};

export function useChatComposerLift({
  bottomInset,
  hidden,
  insetsBottom,
  scrollToBottom
}: UseChatComposerLiftParams) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);
  const baselineLayoutHeightRef = useRef(0);
  const composerLiftAnimation = useRef(new Animated.Value(0)).current;

  function handleLayout(nextHeight: number) {
    setLayoutHeight((current) => (current === nextHeight ? current : nextHeight));

    if (!keyboardVisible || nextHeight > baselineLayoutHeightRef.current) {
      baselineLayoutHeightRef.current = nextHeight;
    }
  }

  function handleComposerFocus() {
    scrollToBottom(false);
  }

  useEffect(() => {
    const showSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (event) => {
      const screenHeight = Dimensions.get("screen").height;
      const nextKeyboardHeight = Math.max(event.endCoordinates.height, Math.max(0, screenHeight - event.endCoordinates.screenY));

      setKeyboardVisible(true);
      setKeyboardHeight(nextKeyboardHeight);
      scrollToBottom(false);
    });
    const hideSubscription = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollToBottom]);

  useEffect(() => {
    if (!keyboardVisible && layoutHeight > 0) {
      baselineLayoutHeightRef.current = layoutHeight;
    }
  }, [keyboardVisible, layoutHeight]);

  useEffect(() => {
    const hiddenComposerFloor = Math.max(insetsBottom, spacing.sm);
    const composerPaddingBottom = Platform.OS === "ios" ? Math.max(insetsBottom, spacing.xs) : spacing.xs;
    const visibleComposerMarginBottom = bottomInset > 0 ? bottomInset - composerPaddingBottom : hiddenComposerFloor;
    const baseComposerMarginBottom = hidden ? hiddenComposerFloor : visibleComposerMarginBottom;
    const resizedKeyboardInset =
      Platform.OS === "android" && keyboardVisible
        ? Math.max(0, baselineLayoutHeightRef.current - layoutHeight)
        : 0;
    const targetComposerLift =
      Platform.OS === "android" && keyboardVisible
        ? Math.max(0, keyboardHeight - resizedKeyboardInset - baseComposerMarginBottom)
        : 0;

    composerLiftAnimation.stopAnimation();
    Animated.timing(composerLiftAnimation, {
      duration: keyboardVisible ? 160 : 120,
      easing: Easing.out(Easing.cubic),
      toValue: targetComposerLift,
      useNativeDriver: true
    }).start();
  }, [bottomInset, composerLiftAnimation, hidden, insetsBottom, keyboardHeight, keyboardVisible, layoutHeight]);

  const hiddenComposerFloor = Math.max(insetsBottom, spacing.sm);
  const composerPaddingBottom = Platform.OS === "ios" ? Math.max(insetsBottom, spacing.xs) : spacing.xs;
  const visibleComposerMarginBottom = bottomInset > 0 ? bottomInset - composerPaddingBottom : hiddenComposerFloor;
  const composerMarginBottom = hidden ? hiddenComposerFloor : visibleComposerMarginBottom;

  return {
    composerLiftAnimation,
    composerMarginBottom,
    composerPaddingBottom,
    handleComposerFocus,
    handleLayout
  };
}
