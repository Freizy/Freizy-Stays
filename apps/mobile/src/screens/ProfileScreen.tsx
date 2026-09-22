import React, { useState } from "react";
import { Text, View } from "react-native";
import { SCHOOLS } from "@freizy-stays/shared";
import { Badge, Card, Chip, Empty, ErrorText, PrimaryButton, Screen, Title } from "../components/ui";
import { api } from "../services/api";
import { signOut } from "../services/auth";
import { useSession } from "../store/session";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
      <Text style={{ color: "#666" }}>{label}</Text>
      <Text style={{ fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

export function ProfileScreen() {
  const token = useSession((s) => s.token);
  const profile = useSession((s) => s.profile);
  const setSession = useSession((s) => s.setSession);
  const [school, setSchool] = useState(profile?.school ?? "Legon");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) {
    return (
      <Screen>
        <Title>Profile</Title>
        <Empty>Log in to manage your profile.</Empty>
      </Screen>
    );
  }

  const logout = async () => {
    await signOut();
    setSession(null, null);
  };

  const saveSchool = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const updated = (await api.updateMe(token, { school })) as NonNullable<typeof profile>;
      setSession(token, updated);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
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

      <Card style={{ marginTop: 12 }}>
        <Row label="Phone" value={profile.phone ?? "—"} />
        <Row label="Email" value={profile.email ?? "—"} />
        <Row label="Role" value={profile.role} />
      </Card>

      <View style={{ marginTop: 16, marginBottom: 24 }}>
        <PrimaryButton title="Log out" tone="dark" onPress={logout} />
      </View>

      {profile.role === "ADMIN" && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>School focus</Text>
          <Text style={{ color: "#666", fontSize: 12, marginTop: 2 }}>Drives your Home feed + map focus.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
            {SCHOOLS.map((s) => (
              <Chip key={s} label={s} on={school === s} dark onPress={() => { setSchool(s); setSaved(false); }} />
            ))}
          </View>
          <ErrorText message={error} />
          {saved && <Text style={{ color: "#16A34A", fontWeight: "700", marginTop: 8 }}>✓ Saved</Text>}
          <View style={{ marginTop: 10 }}>
            <PrimaryButton title="Save school" onPress={saveSchool} loading={busy} />
          </View>
        </View>
      )}
    </Screen>
  );
}
