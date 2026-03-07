import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "../stores/auth";
import { NetworkGuard } from "../components/NetworkGuard";
import { useTokens } from "../theme/tokens";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const t = useTokens();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const unsub = initialize();
    return () => {
      unsub.then((unsubscribe) => unsubscribe?.());
    };
  }, [initialize]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <NetworkGuard>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.surface.raised },
          headerTintColor: t.text.primary,
          headerTitleStyle: { fontWeight: "600", fontFamily: "Inter_600SemiBold" },
          contentStyle: { backgroundColor: t.background.primary },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </NetworkGuard>
  );
}
