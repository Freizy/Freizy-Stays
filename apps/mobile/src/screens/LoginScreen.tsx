import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "../services/supabase";
import { theme } from "../theme";
import { BRAND } from "@freizy-stays/shared";

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onAuthed: (token: string) => void;
  onDevBypass: () => void;
}

export function LoginScreen({ onAuthed, onDevBypass }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Expo Go → exp://<lan-ip>:8081/--/auth/callback · EAS builds → freizystays://auth/callback
  const redirectTo = makeRedirectUri({ native: "freizystays://auth/callback", path: "auth/callback" });

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    setError(null);
    const name = provider === "google" ? "Google" : "Apple";
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(`Could not start ${name} login`);
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== "success") throw new Error("Login was interrupted before completing — try again.");
      const returned = new URL(res.url);
      const hash = new URLSearchParams(returned.hash.replace(/^#/, ""));
      const err = returned.searchParams.get("error") ?? hash.get("error");
      if (err) {
        const desc = returned.searchParams.get("error_description") ?? hash.get("error_description") ?? err;
        throw new Error(decodeURIComponent(desc).replace(/\+/g, " "));
      }
      const code = returned.searchParams.get("code");
      if (code) {
        const { data: sess, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) throw exErr;
        const at = sess.session?.access_token;
        if (!at) throw new Error("No session returned");
        onAuthed(at);
        return;
      }
      // Implicit-flow fallback: tokens arrive in the URL hash.
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setErr) throw setErr;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const at = session?.access_token;
        if (!at) throw new Error("No session returned");
        onAuthed(at);
        return;
      }
      throw new Error(
        __DEV__ ? `No code in callback (${res.url.slice(0, 140)}…)` : `${name} login did not return a code`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : `${name} login failed`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.black }} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={{ flex: 1, padding: 24, paddingBottom: 12 }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ alignItems: "center" }}>
            <Image source={require("../../assets/logo.png")} style={{ width: 130, height: 130, borderRadius: 24 }} resizeMode="contain" />
            <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800", marginTop: 10, fontFamily: theme.fontFamily.display, textAlign: "center" }}>
              FREIZY <Text style={{ color: theme.colors.primary }}>STAYS</Text>
            </Text>
            <Text style={{ color: "#ccc", marginTop: 6, fontSize: 15, textAlign: "center" }}>{BRAND.tagline}</Text>
          </View>

          <TouchableOpacity onPress={() => oauth("google")} disabled={busy} style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, marginTop: 28, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="logo-google" size={18} color="#111" />
              <Text style={{ color: "#111", fontWeight: "700", marginLeft: 8 }}>Continue with Google</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => oauth("apple")} disabled={busy} style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, marginTop: 12, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="logo-apple" size={20} color="#111" />
              <Text style={{ color: "#111", fontWeight: "700", marginLeft: 8 }}>Continue with Apple</Text>
            </View>
          </TouchableOpacity>

          {error && <Text style={{ color: "#ff8080", marginTop: 12, textAlign: "center" }}>{error}</Text>}

          {__DEV__ && (
            <>
              <TouchableOpacity onPress={onDevBypass} style={{ marginTop: 24, alignItems: "center" }}>
                <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Continue in dev mode (no login) →</Text>
              </TouchableOpacity>
              <Text style={{ color: "#555", fontSize: 11, marginTop: 12, textAlign: "center" }}>
                Dev: allowlist this callback in Supabase → Auth → URL Configuration:{"\n"}{redirectTo}
              </Text>
            </>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingBottom: 4 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 5 }}>
            <Image source={require("../../assets/logo2.png")} style={{ width: 26, height: 26 }} resizeMode="contain" />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={{ color: "#BBB", fontSize: 12, fontWeight: "700" }}>© 2026 Freizy Technologies</Text>
            <Text style={{ color: "#777", fontSize: 11 }}>Intelligence Finds You Home</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
