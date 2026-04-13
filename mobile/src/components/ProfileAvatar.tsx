import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import { resolveAvatarPreset, getAvatarInitials } from "../lib/avatarPresets";
import { borders, colors, radii, spacing, typography } from "../theme/tokens";

type ProfileAvatarProps = {
  presetId?: string | null;
  avatarUri?: string | null;
  nickname?: string | null;
  size?: number;
};

export function ProfileAvatar({ presetId, avatarUri, nickname, size = 72 }: ProfileAvatarProps) {
  const preset = resolveAvatarPreset(presetId);
  const badgeSize = Math.max(24, Math.round(size * 0.34));
  const hasCustomAvatar = Boolean(avatarUri);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: preset.backgroundColor
        }
      ]}
    >
      {hasCustomAvatar ? (
        <Image source={{ uri: avatarUri ?? undefined }} style={styles.avatarImage} />
      ) : (
        <>
          <Ionicons color={preset.iconColor} name={preset.iconName} size={Math.round(size * 0.42)} />
          <View
            style={[
              styles.initialBadge,
              {
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2
              }
            ]}
          >
            <Text style={styles.initialBadgeText}>{getAvatarInitials(nickname)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: borders.standard,
    borderColor: "rgba(16, 35, 59, 0.08)",
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  initialBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    backgroundColor: colors.surface,
    borderWidth: borders.standard,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs
  },
  initialBadgeText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: "700"
  }
});
