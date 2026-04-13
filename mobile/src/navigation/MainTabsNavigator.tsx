import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ClinicalTabBar } from "../components/ClinicalTabBar";
import { AIChatScreen } from "../screens/app/AIChatScreen";
import { AdjustmentDetailScreen } from "../screens/app/AdjustmentDetailScreen";
import { DashboardScreen } from "../screens/app/DashboardScreen";
import { ProfileScreen } from "../screens/app/ProfileScreen";
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

const Tab = createBottomTabNavigator<MainTabParamList>();
const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();

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
            <ProfileScreen
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
