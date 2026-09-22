import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Badge, Card, Chip, Empty, ErrorText, Field, Input, PrimaryButton, Screen, Title } from "../components/ui";
import { SchoolPicker } from "../components/SchoolPicker";
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [editPhone, setEditPhone] = useState(profile?.phone ?? "");

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

  const saveProfile = async () => {
    if (!token) return;
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Enter your full name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: { name: string; phone?: string } = { name: trimmedName };
      if (editPhone.trim()) body.phone = editPhone.trim();
      const updated = (await api.updateMe(token, body)) as NonNullable<typeof profile>;
      setSession(token, updated);
      setEditing(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
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
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Title>Profile</Title>
        <TouchableOpacity onPress={() => { setEditing(!editing); setSaved(false); setError(null); }} style={{ backgroundColor: editing ? "#F5F5F5" : "#0A0A0A", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 }}>
          <Text style={{ color: editing ? "#111" : "#fff", fontWeight: "700" }}>{editing ? "Cancel" : "Edit"}</Text>
        </TouchableOpacity>
      </View>
      <Card style={{ marginTop: 12, alignItems: "center", paddingVertical: 20 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#FDECEC", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 28 }}>👤</Text>
        </View>
          <Text style={{ fontWeight: "800", fontSize: 17, marginTop: 8 }}>{profile.name ?? profile.phone ?? profile.email ?? "Student"}</Text>
        <View style={{ marginTop: 6 }}>
          <Badge tone={profile.role === "STUDENT" ? "muted" : "verified"}>{profile.role}</Badge>
        </View>
      </Card>

      {editing && (
        <Card style={{ marginTop: 12 }}>
          <Field label="Full name">
            <Input value={name} onChangeText={(v) => { setName(v); setSaved(false); }} placeholder="e.g. Ama Serwaa" autoCapitalize="words" />
          </Field>
          <Field label="Phone number">
            <Input value={editPhone} onChangeText={(v) => { setEditPhone(v); setSaved(false); }} keyboardType="phone-pad" placeholder="+233…" autoCapitalize="none" />
          </Field>
          <ErrorText message={error} />
          <View style={{ marginTop: 12 }}>
            <PrimaryButton title="Save changes" onPress={saveProfile} loading={busy} />
          </View>
        </Card>
      )}

      <Card style={{ marginTop: 12 }}>
        <Row label="Phone" value={profile.phone ?? "—"} />
        <Row label="Email" value={profile.email ?? "—"} />
        <Row label="Role" value={profile.role} />
      </Card>

      {(profile.role === "ADMIN" || profile.role === "OWNER") && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>School focus</Text>
          <Text style={{ color: "#666", fontSize: 12, marginTop: 2 }}>Drives your Home feed + map focus.</Text>
          <View style={{ marginTop: 8 }}>
            <SchoolPicker value={school} dark onChange={(s) => { setSchool(s); setSaved(false); }} />
          </View>
          <ErrorText message={error} />
          {saved && <Text style={{ color: "#16A34A", fontWeight: "700", marginTop: 8 }}>✓ Saved</Text>}
          <View style={{ marginTop: 10 }}>
            <PrimaryButton title="Save school" onPress={saveSchool} loading={busy} />
          </View>
        </View>
      )}
      <View style={{ marginTop: 16, marginBottom: 24 }}>
        <PrimaryButton title="Log out" tone="dark" onPress={logout} />
      </View>
    </Screen>
  );
}
