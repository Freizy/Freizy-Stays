import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { MUST_HAVES, SCHOOLS } from "@freizy-stays/shared";
import { Badge, Card, Chip, ErrorText, PrimaryButton, Screen, Sub, Title, ghs } from "../components/ui";
import { api } from "../services/api";
import { signOut } from "../services/auth";
import { useSession } from "../store/session";

const BUDGET_PRESETS = [2000, 2500, 3000, 3500, 5000, 8000];

export function ProfileScreen() {
  const token = useSession((s) => s.token);
  const profile = useSession((s) => s.profile);
  const setSession = useSession((s) => s.setSession);
  const [school, setSchool] = useState(profile?.school ?? "Legon");
  const [budget, setBudget] = useState(profile?.budget ?? 3500);
  const [mustHaves, setMustHaves] = useState<string[]>(profile?.mustHaves ?? []);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token || !profile) {
    return (
      <Screen>
        <Title>Profile</Title>
        <Sub>Log in to manage your profile.</Sub>
      </Screen>
    );
  }

  const toggle = (v: string) => {
    setSaved(false);
    setMustHaves((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = (await api.updateMe(token, { school, budget, mustHaves })) as typeof profile;
      setSession(token, updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await signOut();
    setSession(null, null);
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Profile</Title>
        <Card style={{ marginTop: 12, alignItems: "center", paddingVertical: 20 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#FDECEC", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 28 }}>👤</Text>
          </View>
          <Text style={{ fontWeight: "800", fontSize: 17, marginTop: 8 }}>{profile.phone ?? profile.email ?? "Student"}</Text>
          <View style={{ marginTop: 6 }}>
            <Badge tone={profile.role === "STUDENT" ? "muted" : "verified"}>{profile.role}</Badge>
          </View>
        </Card>

        <Text style={{ fontWeight: "800", marginTop: 18, fontSize: 16 }}>Preferences</Text>
        <Text style={{ fontWeight: "700", marginTop: 10 }}>School</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
          {SCHOOLS.map((s) => (
            <Chip key={s} label={s} on={school === s} dark onPress={() => { setSchool(s); setSaved(false); }} />
          ))}
        </View>

        <Text style={{ fontWeight: "700", marginTop: 10 }}>Budget: {ghs(budget)}/sem</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
          {BUDGET_PRESETS.map((b) => (
            <Chip key={b} label={`GH₵${b.toLocaleString()}`} on={budget === b} onPress={() => { setBudget(b); setSaved(false); }} />
          ))}
        </View>

        <Text style={{ fontWeight: "700", marginTop: 10 }}>Must-haves</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
          {MUST_HAVES.map((m) => (
            <Chip key={m} label={m} on={mustHaves.includes(m)} onPress={() => toggle(m)} />
          ))}
        </View>

        <ErrorText message={error} />
        {saved && <Text style={{ color: "#16A34A", fontWeight: "700", marginTop: 12 }}>✓ Saved</Text>}
        <View style={{ marginTop: 14 }}>
          <PrimaryButton title="Save preferences" onPress={save} loading={busy} />
        </View>
        <View style={{ marginTop: 10, marginBottom: 24 }}>
          <PrimaryButton title="Log out" tone="dark" onPress={logout} />
        </View>
      </ScrollView>
    </Screen>
  );
}
