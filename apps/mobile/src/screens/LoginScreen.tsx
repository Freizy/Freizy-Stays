import React, { useState } from "react";
import { Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { theme } from "../theme";
import { BRAND } from "@freizy-stays/shared";
import { PrimaryButton } from "../components/ui";
import { sendOtp, verifyOtp } from "../services/auth";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";

WebBrowser.maybeCompleteAuthSession();

interface Props {
  onAuthed: (token: string) => void;
  onDevBypass: () => void;
}

export function LoginScreen({ onAuthed, onDevBypass }: Props) {
  const [phone, setPhone] = useState("+233");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendOtp(phone.trim());
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      onAuthed(await verifyOtp(phone.trim(), code.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    setError(null);
    const name = provider === "google" ? "Google" : "Apple";
    try {
      const redirectTo = makeRedirectUri({ scheme: "freizystays", path: "auth/callback" });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(`Could not start ${name} login`);
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== "success") return;
      const code = new URL(res.url).searchParams.get("code");
      if (!code) throw new Error(`${name} login did not return a code`);
      const { data: sess, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) throw exErr;
      const at = sess.session?.access_token;
      if (!at) throw new Error("No session returned");
      onAuthed(at);
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

        {step === "phone" ? (
          <>
            <Text style={{ color: "#999", marginTop: 28 }}>Enter your phone number to get a login code.</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              placeholder="+233201234567"
              placeholderTextColor="#666"
              style={{ backgroundColor: "#1c1c1c", color: "#fff", borderRadius: 12, padding: 15, marginTop: 12, fontSize: 17 }}
            />
            <View style={{ marginTop: 12 }}>
              <PrimaryButton title="Send code" onPress={send} loading={busy} />
            </View>
          </>
        ) : (
          <>
            <Text style={{ color: "#999", marginTop: 28 }}>Code sent to {phone}.</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="6-digit code"
              placeholderTextColor="#666"
              style={{ backgroundColor: "#1c1c1c", color: "#fff", borderRadius: 12, padding: 15, marginTop: 12, fontSize: 20, letterSpacing: 4 }}
            />
            <View style={{ marginTop: 12 }}>
              <PrimaryButton title="Verify & continue" onPress={confirm} loading={busy} />
            </View>
            <TouchableOpacity onPress={() => setStep("phone")} style={{ marginTop: 14 }}>
              <Text style={{ color: "#888" }}>← Change number</Text>
            </TouchableOpacity>
          </>
        )}

        {error && <Text style={{ color: "#ff8080", marginTop: 12 }}>{error}</Text>}

        <TouchableOpacity onPress={() => oauth("google")} disabled={busy} style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, marginTop: 12, alignItems: "center" }}>
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

        <TouchableOpacity onPress={onDevBypass} style={{ marginTop: 36, alignItems: "center" }}>
          <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Continue in dev mode (no SMS) →</Text>
        </TouchableOpacity>

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
