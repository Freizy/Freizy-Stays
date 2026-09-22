import React from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { theme } from "../theme";

export { distKm } from "@freizy-stays/shared";

export const ghs = (n: number) => `GH₵ ${n.toLocaleString()}`;

export function Screen({ children, pad = true, style }: { children: React.ReactNode; pad?: boolean; style?: ViewStyle }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={[{ flex: 1, paddingHorizontal: pad ? 16 : 0, paddingBottom: pad ? 16 : 0, paddingTop: pad ? 4 : 0 }, style]}>{children}</View>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 24, fontWeight: "800", color: theme.colors.text }}>{children}</Text>;
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: "#EDEDED",
          borderRadius: theme.radius.lg,
          padding: 14,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Chip({ label, on, onPress, dark = false }: { label: string; on: boolean; onPress: () => void; dark?: boolean }) {
  const bg = on ? (dark ? theme.colors.black : theme.colors.primary) : theme.colors.muted;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, marginBottom: 8 }}
    >
      <Text style={{ color: on ? "#fff" : theme.colors.text, fontWeight: on ? "700" : "400" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  tone = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "primary" | "dark";
}) {
  const bg = tone === "dark" ? theme.colors.black : theme.colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={{ backgroundColor: bg, borderRadius: 12, padding: 15, alignItems: "center", opacity: disabled ? 0.5 : 1 }}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function GhostButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ backgroundColor: theme.colors.muted, borderRadius: 12, padding: 14, alignItems: "center" }}>
      <Text style={{ fontWeight: "700" }}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Badge({ tone, children }: { tone: "verified" | "pending" | "danger" | "muted"; children: React.ReactNode }) {
  const colors = {
    verified: { fg: theme.colors.verified, bg: "#EAF7EF" },
    pending: { fg: "#B45309", bg: "#FEF3C7" },
    danger: { fg: theme.colors.primary, bg: "#FDECEC" },
    muted: { fg: theme.colors.textMuted, bg: theme.colors.muted },
  } as const;
  const c = colors[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" }}>
      <Text style={{ color: c.fg, fontWeight: "700", fontSize: 12 }}>{children}</Text>
    </View>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ fontWeight: "700", marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#999"
      style={[{ borderWidth: 1, borderColor: "#E5E5E5", borderRadius: 12, padding: 13, fontSize: 16, backgroundColor: "#fff" }, props.style]}
    />
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: theme.colors.textMuted, marginTop: 8 }}>{children}</Text>;
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={{ color: theme.colors.primary, marginTop: 12 }}>{message}</Text>;
}
