import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { MUST_HAVES, SCHOOLS, type Role, type UserProfile } from "@freizy-stays/shared";
import { Chip, ErrorText, Field, PrimaryButton, Screen, Sub, Title } from "../components/ui";
import { api } from "../services/api";

const BUDGET_PRESETS = [2000, 2500, 3000, 3500, 5000, 8000];

interface Props {
  token: string;
  onDone: (profile: UserProfile) => void;
}

export function OnboardingScreen({ token, onDone }: Props) {
  const [role, setRole] = useState<Role>("STUDENT");
  const [school, setSchool] = useState<string>("Legon");
  const [budget, setBudget] = useState<number>(3500);
  const [mustHaves, setMustHaves] = useState<string[]>(["Water 24/7", "WiFi"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (v: string) => setMustHaves((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone((await api.updateMe(token, { role, school, budget, mustHaves })) as UserProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Find your home 🏠</Title>
        <Sub>30 seconds — we match hostels to you.</Sub>

        <Field label="I am a…">
          <View style={{ flexDirection: "row" }}>
            {(["STUDENT", "OWNER"] as Role[]).map((r) => (
              <Chip key={r} label={r === "STUDENT" ? "🎓 Student" : "🏢 Hostel Owner"} on={role === r} onPress={() => setRole(r)} />
            ))}
          </View>
        </Field>

        <Field label="School?">
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {SCHOOLS.map((s) => (
              <Chip key={s} label={s} on={school === s} onPress={() => setSchool(s)} />
            ))}
          </View>
        </Field>

        <Field label={`Budget per semester? GH₵ ${budget.toLocaleString()}`}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {BUDGET_PRESETS.map((b) => (
              <Chip key={b} label={`GH₵${b.toLocaleString()}`} on={budget === b} onPress={() => setBudget(b)} />
            ))}
          </View>
        </Field>

        <Field label="Must-haves?">
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {MUST_HAVES.map((m) => (
              <Chip key={m} label={m} on={mustHaves.includes(m)} onPress={() => toggle(m)} />
            ))}
          </View>
        </Field>

        <ErrorText message={error} />
        <View style={{ marginTop: 20, marginBottom: 24 }}>
          <PrimaryButton title="Show my matches →" onPress={save} loading={busy} />
        </View>
        <Text style={{ textAlign: "center", color: "#999", fontSize: 12, marginBottom: 16 }}>Intelligence Finds You Home</Text>
      </ScrollView>
    </Screen>
  );
}
