import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  BookOpen,
  Compass,
  House,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { HomeScreen } from '../features/home/HomeScreen';
import {
  CommunityScreen,
  DocumentsScreen,
  ExploreScreen,
} from '../features/pending/PendingFeatureScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { colors } from '../shared/theme/tokens';
import type { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();
const icon =
  (Icon: LucideIcon) =>
  ({
    color,
    size,
    focused,
  }: {
    color: string;
    size: number;
    focused: boolean;
  }) =>
    <Icon color={color} size={size} strokeWidth={focused ? 2.4 : 1.7} />;

// Register domain screens here; keep their business logic in features/<domain>.
const tabs = [
  {
    name: 'Home',
    title: 'Trang chủ',
    component: HomeScreen,
    tabBarIcon: icon(House),
  },
  {
    name: 'Explore',
    title: 'Khám phá',
    component: ExploreScreen,
    tabBarIcon: icon(Compass),
  },
  {
    name: 'Community',
    title: 'Cộng đồng',
    component: CommunityScreen,
    tabBarIcon: icon(Users),
  },
  {
    name: 'Documents',
    title: 'Tài liệu',
    component: DocumentsScreen,
    tabBarIcon: icon(BookOpen),
  },
  {
    name: 'Profile',
    title: 'Cá nhân',
    component: ProfileScreen,
    tabBarIcon: icon(UserRound),
  },
] as const;

export function AppTabs() {
  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarHideOnKeyboard: true,
        sceneStyle: styles.scene,
      }}
    >
      {tabs.map(({ name, title, component, tabBarIcon }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{ title, tabBarIcon, tabBarButtonTestID: `tab-${name}` }}
        />
      ))}
    </Tab.Navigator>
  );
}
const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  label: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  scene: { backgroundColor: colors.background },
});
