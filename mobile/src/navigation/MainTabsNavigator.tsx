/**
 * 主导航容器。
 *
 * 结构上采用“底部 Tab + 局部 Stack”的组合：
 * 1. Tab 负责一级信息架构：首页、AI 对话、我的。
 * 2. Dashboard/Profile 内部再各自维护二级详情页，避免不同模块的页面互相耦合。
 * 3. 外层统一挂载沉浸式底栏上下文，让滚动页面可以共享底栏显隐逻辑。
 */
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ClinicalTabBar } from "../components/ClinicalTabBar";
import { AIChatScreen } from "../features/chat/screens/AIChatScreen";
import { AdjustmentDetailScreen } from "../features/dashboard/screens/AdjustmentDetailScreen";
import { DashboardScreen } from "../features/dashboard/screens/DashboardScreen";
import { StepDetailScreen } from "../features/dashboard/screens/StepDetailScreen";
import { ProfileDetailScreen } from "../features/profile/screens/ProfileDetailScreen";
import { ProfileScreen } from "../features/profile/screens/ProfileScreen";
import { ProfileSettingsScreen } from "../features/profile/screens/ProfileSettingsScreen";
import type { ProfileDetailKind } from "../features/profile/model/profileDetailTypes";
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
  StepDetail: {
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
  // 仪表盘单独维护一个栈，方便从首页直接推入“调整详情”而不污染全局 Tab 状态。
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
            onOpenStepDetail={(snapshot) => screenProps.navigation.navigate("StepDetail", { snapshot })}
            onRequestSignIn={onRequestSignIn}
            refreshToken={refreshToken}
            session={session}
          />
        )}
      </DashboardStack.Screen>
      <DashboardStack.Screen component={AdjustmentDetailScreen} name="AdjustmentDetail" />
      <DashboardStack.Screen name="StepDetail">
        {(screenProps) => <StepDetailScreen {...screenProps} healthProfile={healthProfile} session={session} />}
      </DashboardStack.Screen>
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
  // 档案相关页面集中放在一个栈里，便于在“主页 / 设置 / 详情”之间来回跳转。
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
  // AIChat 保持为一级 Tab，而不是嵌在某个 Stack 中，
  // 这样用户可以始终把它当成主输入入口快速切换进入。
  return (
    <ImmersiveTabBarProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: "absolute"
          }
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

