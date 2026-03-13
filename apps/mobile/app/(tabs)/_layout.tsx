import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { ChatFAB } from '../../components/ChatFAB';
import { useTokens } from '../../theme/tokens';
import { NotificationBell } from '../../components/NotificationBell';

function HomeIcon({ focused }: { focused: boolean }) {
  return <View style={{ opacity: focused ? 1 : 0.45 }}><View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: focused ? '#6c5ce7' : '#8b8ba7' }} /></View>;
}

// Simple tab icon text labels (emoji stripped for design consistency — could be replaced with Phosphor icons)
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Home: { active: '⌂', inactive: '⌂' },
  Payments: { active: '↑↓', inactive: '↑↓' },
  Activity: { active: '≡', inactive: '≡' },
  Profile: { active: '○', inactive: '○' },
};

export default function TabsLayout() {
  const t = useTokens();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            backgroundColor: t.surface.raised,
            borderTopColor: t.border.default,
            borderTopWidth: 1,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
          },
          tabBarActiveTintColor: t.brand.default,
          tabBarInactiveTintColor: t.text.tertiary,
          tabBarLabelStyle: { fontSize: 11, fontFamily: 'Inter_500Medium' },
          headerStyle: { backgroundColor: t.surface.raised },
          headerTintColor: t.text.primary,
          headerTitleStyle: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            headerTitle: 'Agentic Bank',
            headerRight: () => <NotificationBell />,
            tabBarIcon: ({ focused, color }) => (
              <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 18, height: 14, borderWidth: 1.5, borderColor: color, borderRadius: 3, marginTop: 4 }} />
                <View style={{ width: 8, height: 8, borderWidth: 1.5, borderColor: color, borderRadius: 2, position: 'absolute', top: 0 }} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="payments"
          options={{
            title: 'Payments',
            headerTitle: 'Payments',
            tabBarIcon: ({ focused, color }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 24, height: 24, gap: 2 }}>
                <View style={{ width: 14, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ translateY: -2 }] }} />
                <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color, transform: [{ translateY: -6 }] }} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            headerTitle: 'Activity',
            tabBarIcon: ({ focused, color }) => (
              <View style={{ alignItems: 'flex-start', justifyContent: 'center', width: 24, height: 24, gap: 3 }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{ height: 1.5, width: [20, 14, 17][i], backgroundColor: color, borderRadius: 1 }} />
                ))}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            headerTitle: 'Profile',
            tabBarIcon: ({ focused, color }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: color, marginBottom: 2 }} />
                <View style={{ width: 18, height: 6, borderRadius: 6, borderWidth: 1.5, borderColor: color, borderBottomWidth: 0 }} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="loans"
          options={{
            title: 'Loans',
            headerTitle: 'Loans & Credit',
            tabBarIcon: ({ color }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                <View style={{ width: 18, height: 12, borderWidth: 1.5, borderColor: color, borderRadius: 3 }} />
                <View style={{ width: 10, height: 4, backgroundColor: color, borderRadius: 1, marginTop: 2 }} />
              </View>
            ),
          }}
        />

        {/* Hidden screens — not shown as tabs */}
        <Tabs.Screen name="chat" options={{ href: null }} />
        <Tabs.Screen name="transactions" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>

      {/* ChatFAB floats above tab bar */}
      <ChatFAB />
    </View>
  );
}
