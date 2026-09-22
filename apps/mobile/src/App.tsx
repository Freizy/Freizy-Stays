import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Orbitron_800ExtraBold, useFonts } from "@expo-google-fonts/orbitron";
import { LoginScreen } from "./screens/LoginScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { DashboardScreen } from "./screens/MoreScreens";
import { AdminScreen } from "./screens/AdminScreen";
import { MapScreen } from "./screens/MapScreen";
import { HomeStack } from "./navigation/HomeStack";
import { OwnerStack } from "./navigation/OwnerStack";
import { useSession } from "./store/session";
import { loadProfile, restoreToken, signOut, getLastProfileError } from "./services/auth";
import { theme } from "./theme";
import { API_BASE } from "./services/api";
import { GhostButton, PrimaryButton } from "./components/ui";
import { registerPushToken, setupPushListeners } from "./services/push";
import { goTab, navigationRef } from "./services/navigation";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function tabIcon(active: string, inactive: string) {
  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={(focused ? active : inactive) as keyof typeof Ionicons.glyphMap} size={size} color={color} />
  );
}

function MainTabs() {
  const profile = useSession((s) => s.profile);
  return (
    <Tabs.Navigator screenOptions={{ tabBarActiveTintColor: theme.colors.primary, tabBarInactiveTintColor: "#8E8E93" }}>
      <Tabs.Screen name="Home" component={HomeStack} options={{ headerShown: false, tabBarIcon: tabIcon("home", "home-outline") }} />
      <Tabs.Screen name="Explore" component={MapScreen} options={{ headerShown: false, tabBarIcon: tabIcon("compass", "compass-outline") }} />
      {profile?.role !== "ADMIN" && (
        <Tabs.Screen name="Bookings" component={DashboardScreen} options={{ tabBarIcon: tabIcon("calendar", "calendar-outline") }} />
      )}
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: tabIcon("person", "person-outline") }} />
      {profile?.role === "OWNER" && (
        <Tabs.Screen name="Owner" component={OwnerStack} options={{ headerShown: false, tabBarIcon: tabIcon("business", "business-outline") }} />
      )}
      {profile?.role === "ADMIN" && (
        <Tabs.Screen name="Admin" component={AdminScreen} options={{ tabBarIcon: tabIcon("shield-checkmark", "shield-checkmark-outline") }} />
      )}
    </Tabs.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Orbitron_800ExtraBold });
  const [devIn, setDevIn] = useState(false);
  const [booting, setBooting] = useState(true);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const token = useSession((s) => s.token);
  const profile = useSession((s) => s.profile);
  const setSession = useSession((s) => s.setSession);
  useEffect(() => {
    const sub = setupPushListeners((tab: string) => {
      if (tab === "Bookings" || tab === "Owner" || tab === "Home") goTab(tab);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const t = await restoreToken();
        if (t) {
          const p = await loadProfile(t);
          if (p) {
            setSession(t, p);
            registerPushToken(t);
          } else {
            setPendingToken(t);
          }
        }
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuthed = async (t: string) => {
    const p = await loadProfile(t);
    if (p) {
      setSession(t, p);
      setPendingToken(null);
      registerPushToken(t);
    } else {
      setPendingToken(t);
    }
  };

  const retryProfile = async () => {
    if (!pendingToken) return;
    setProfileLoading(true);
    const p = await loadProfile(pendingToken);
    setProfileLoading(false);
    if (p) {
      setSession(pendingToken, p);
      setPendingToken(null);
      setProfileError(null);
      registerPushToken(pendingToken);
    } else {
      setProfileError(getLastProfileError());
    }
  };

  const startOver = async () => {
    await signOut();
    setPendingToken(null);
  };

  if (booting || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.black, alignItems: "center", justifyContent: "center" }}>
        <Image source={require("../assets/logo3.png")} style={{ width: 120, height: 120 }} resizeMode="contain" />
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: 2, marginTop: 12 }}>FREIZY STAYS</Text>
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  const authed = devIn || !!token || !!pendingToken;
  const needsOnboarding = !!token && !devIn && !!profile && profile.role === "STUDENT" && !profile.school;
  const showRetry = !devIn && !token && !!pendingToken;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!authed ? (
          <Stack.Screen name="Login">
            {() => <LoginScreen onAuthed={handleAuthed} onDevBypass={() => setDevIn(true)} />}
          </Stack.Screen>
        ) : showRetry ? (
          <Stack.Screen name="Retry">
            {() => (
              <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 24 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", textAlign: "center" }}>Can't reach the Freizy server</Text>
                <Text style={{ color: "#666", textAlign: "center", marginTop: 8 }}>
                  You're logged in, but your profile didn't load. The app is trying:{"\n"}{API_BASE}{"\n\n"}
                  On a physical phone, localhost never works — set EXPO_PUBLIC_API_URL to your PC's LAN IP
                  (e.g. http://192.168.43.131:4000/api) in apps/mobile/.env and restart Expo.
                </Text>
                {!!profileError && (
                  <Text style={{ color: theme.colors.primary, textAlign: "center", marginTop: 8 }}>{profileError}</Text>
                )}
                <View style={{ marginTop: 16, width: "100%" }}>
                  <PrimaryButton title="Retry" onPress={retryProfile} loading={profileLoading} />
                </View>
                <View style={{ marginTop: 10, width: "100%" }}>
                  <GhostButton title="Log out & start over" onPress={startOver} />
                </View>
              </View>
            )}
          </Stack.Screen>
        ) : needsOnboarding && token ? (
          <Stack.Screen name="Onboarding">
            {() => <OnboardingScreen token={token} onDone={(p) => setSession(token, p)} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export { signOut };
