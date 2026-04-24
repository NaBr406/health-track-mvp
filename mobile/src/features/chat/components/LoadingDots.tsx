import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../../../theme/tokens";

export function LoadingDots() {
  const dotAnimations = useRef([
    new Animated.Value(0.35),
    new Animated.Value(0.35),
    new Animated.Value(0.35)
  ]).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.stagger(
        180,
        dotAnimations.map((value) =>
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: 280,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true
            }),
            Animated.timing(value, {
              toValue: 0.35,
              duration: 280,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true
            })
          ])
        )
      )
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [dotAnimations]);

  return (
    <View style={styles.loadingDotsRow}>
      {dotAnimations.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.loadingDot,
            {
              opacity: value,
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0.35, 1],
                    outputRange: [0, -2]
                  })
                }
              ]
            }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  loadingDot: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.textSoft
  }
});
