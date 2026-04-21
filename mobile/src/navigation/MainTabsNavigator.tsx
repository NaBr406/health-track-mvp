import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ClinicalTabBar } from "../components/ClinicalTabBar";
import { AIChatScreen } from "../screens/app/AIChatScreen";
import { AdjustmentDetailScreen } from "../screens/app/AdjustmentDetailScreen";
import { DashboardScreen } from "../screens/app/DashboardScreen";
import { ProfileDetailScreen } from "../screens/app/ProfileDetailScreen";
import { ProfileScreen } from "../screens/app/ProfileScreen";
import { ProfileSettingsScreen } from "../screens/app/ProfileSettingsScreen";
import type { ProfileDetailKind } from "../screens/app/profileDetailTypes";
import { colors } from "../theme/tokens";
import type { AuthSession, DashboardSnapshot, HealthProfile } from "../types";
import { ImmersiveTabBarProvider } from "./ImmersiveTabBarContext";

export type MainTabParamList = {
  Dashboard: undefined;
  AIChat: undefined;
  Profile: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
  AdjustmentDetail: {
    snapshot: DashboardSnapshot;
  };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  ProfileSettings: undefined;
  ProfileDetail: {
    kind: ProfileDetailKind;
  };
};

type MainTabsNavigatorProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  refreshToken: number;
  onConversationCommitted: () => void;
  onEditHealthProfile: () => void;
  onLogout: () => Promise<void>;
  onRequestSignIn: () => void;
};

type DashboardStackNavigatorProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  refreshToken: number;
  onRequestSignIn: () => void;
};

type ProfileStackNavigatorProps = {
  session: AuthSession | null;
  healthProfile: HealthProfile | null;
  onEditHealthProfile: () => void;
  onLogout: () => Promise<void>;
  onRequestSignIn: () => void;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function DashboardStackNavigator({
  session,
  healthProfile,
  refreshToken,
  onRequestSignIn
}: DashboardStackNavigatorProps) {
  return (
    <DashboardStack.Navigator
      screenOptions={{
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
        headerShown: false
      }}
    >
      <DashboardStack.Screen name="DashboardHome">
        {(screenProps) => (
          <DashboardScreen
            healthProfile={healthProfile}
            onOpenAdjustmentDetail={(snapshot) => screenProps.navigation.navigate("AdjustmentDetail", { snapshot })}
            onRequestSignIn={onRequestSignIn}
            refreshToken={refreshToken}
            session={session}
          />
        )}
      </DashboardStack.Screen>
      <DashboardStack.Screen component={AdjustmentDetailScreen} name="AdjustmentDetail" />
    </DashboardStack.Navigator>
  );
}

function ProfileStackNavigator({
  session,
  healthProfile,
  onEditHealthProfile,
  onLogout,
  onRequestSignIn
}: ProfileStackNavigatorProps) {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
        headerShown: false
      }}
    >
      <ProfileStack.Screen name="ProfileHome">
        {(screenProps) => (
          <ProfileScreen
            healthProfile={healthProfile}
            onEditHealthProfile={onEditHealthProfile}
            onGoToAIChat={() => screenProps.navigation.getParent()?.navigate("AIChat")}
            onOpenDetail={(kind) => screenProps.navigation.navigate("ProfileDetail", { kind })}
            onOpenSettings={() => screenProps.navigation.navigate("ProfileSettings")}
            onRequestSignIn={onRequestSignIn}
            session={session}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="ProfileSettings">
        {(screenProps) => (
          <ProfileSettingsScreen
            onBack={() => screenProps.navigation.goBack()}
            onLogout={onLogout}
            onOpenDetail={(kind) => screenProps.navigation.navigate("ProfileDetail", { kind })}
            onRequestSignIn={onRequestSignIn}
            session={session}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="ProfileDetail">
        {(screenProps) => (
          <ProfileDetailScreen
            healthProfile={healthProfile}
            kind={screenProps.route.params.kind}
            onBack={() => screenProps.navigation.goBack()}
            onEditHealthProfile={onEditHealthProfile}
            onGoToAIChat={() => screenProps.navigation.getParent()?.navigate("AIChat")}
            onLogout={onLogout}
            onRequestSignIn={onRequestSignIn}
            session={session}
          />
        )}
      </ProfileStack.Screen>
    </ProfileStack.Navigator>
  );
}

export function MainTabsNavigator({
  session,
  healthProfile,
  refreshToken,
  onConversationCommitted,
  onEditHealthProfile,
  onLogout,
  onRequestSignIn
}: MainTabsNavigatorProps) {
  return (
    <ImmersiveTabBarProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false
        }}
        tabBar={(props) => <ClinicalTabBar {...props} />}
      >
        <Tab.Screen name="Dashboard" options={{ title: "首页" }}>
          {() => (
            <DashboardStackNavigator
              healthProfile={healthProfile}
              onRequestSignIn={onRequestSignIn}
              refreshToken={refreshToken}
              session={session}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="AIChat" options={{ title: "AI 交流" }}>
          {() => (
            <AIChatScreen
              healthProfile={healthProfile}
              onConversationCommitted={onConversationCommitted}
              onRequestSignIn={onRequestSignIn}
              session={session}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Profile" options={{ title: "我的" }}>
          {() => (
            <ProfileStackNavigator
              healthProfile={healthProfile}
              onEditHealthProfile={onEditHealthProfile}
              onLogout={onLogout}
              onRequestSignIn={onRequestSignIn}
              session={session}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </ImmersiveTabBarProvider>
  );
}
