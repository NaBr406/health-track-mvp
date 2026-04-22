/**
 * 自定义底部标签栏，支持沉浸式页面里的显隐联动。
 */
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useEffect, useRef, useState } from "react";
import { Animated, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTabBarBottomOffset, useImmersiveTabBar } from "../navigation/ImmersiveTabBarContext";
import { colors, layout, radii, shadows, spacing, typography } from "../theme/tokens";

export function ClinicalTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { hidden } = useImmersiveTabBar();
  const activeRoute = state.routes[state.index];
  const nestedRouteName = getDeepestRouteName(activeRoute.state);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;
  const bottomOffset = getTabBarBottomOffset(insets.bottom);

  const shouldHide = hidden || keyboardVisible;

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    Animated.spring(animation, {
      damping: 22,
      mass: 0.9,
      stiffness: 240,
      toValue: shouldHide ? 1 : 0,
      useNativeDriver: true
    }).start();
  }, [animation, shouldHide]);

  if (nestedRouteName === "AdjustmentDetail" || nestedRouteName === "ProfileDetail" || nestedRouteName === "ProfileSettings") {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={shouldHide ? "none" : "auto"}
      style={[
        styles.portal,
        {
          paddingBottom: bottomOffset,
          opacity: animation.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0]
          }),
          transform: [
            {
              translateY: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, layout.tabBarHeight + bottomOffset + spacing.xl]
              })
            }
          ]
        }
      ]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label =
            descriptors[route.key].options.tabBarLabel ??
            descriptors[route.key].options.title ??
            route.name;
          const iconName = getTabIcon(route.name, isFocused);

          return (
            <Pressable
              accessibilityRole="button"
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={({ pressed }) => [styles.item, isFocused ? styles.itemActive : null, pressed ? styles.itemPressed : null]}
            >
              <Ionicons color={isFocused ? colors.primary : colors.textSoft} name={iconName} size={18} />
              <Text style={[styles.label, isFocused ? styles.labelActive : null]}>{String(label)}</Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function getDeepestRouteName(state: unknown): string | undefined {
  if (!state || typeof state !== "object" || !("routes" in state) || !("index" in state)) {
    return undefined;
  }

  const typedState = state as {
    index: number;
    routes: Array<{ name: string; state?: unknown }>;
  };
  const activeRoute = typedState.routes[typedState.index];

  if (!activeRoute) {
    return undefined;
  }

  return getDeepestRouteName(activeRoute.state) ?? activeRoute.name;
}

function getTabIcon(routeName: string, isFocused: boolean) {
  if (routeName === "Dashboard") {
    return isFocused ? "home" : "home-outline";
  }

  if (routeName === "AIChat") {
    return isFocused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline";
  }

  return isFocused ? "person-circle" : "person-circle-outline";
}

const styles = StyleSheet.create({
  portal: {
    position: "absolute",
    bottom: 0,
    left: layout.pageHorizontal,
    right: layout.pageHorizontal
  },
  bar: {
    flexDirection: "row",
    minHeight: layout.tabBarHeight,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    padding: spacing.xs,
    gap: spacing.xs,
    ...shadows.lift
  },
  item: {
    flex: 1,
    minHeight: 58,
    borderRadius: radii.lg,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.xs
  },
  itemActive: {
    backgroundColor: colors.primarySoft
  },
  itemPressed: {
    backgroundColor: colors.pressed
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "700"
  },
  labelActive: {
    color: colors.primary
  }
});
