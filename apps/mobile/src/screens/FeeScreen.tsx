import React, { useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ACCESS_FEE_GHS, type PaymentProvider } from "@freizy-stays/shared";
import { Card, Chip, ErrorText, Input, PrimaryButton, Screen, Sub, Title, ghs } from "../components/ui";
import { api } from "../services/api";
import { useSession } from "../store/session";

const PROVIDERS: { id: PaymentProvider; label: string }[] = [
  { id: "MTN_MOMO", label: "MTN MoMo" },
  { id: "VODAFONE_CASH", label: "Vodafone Cash" },
  { id: "CARD", label: "Card" },
];

/** One-time onboarding fee gate: GH₵50 student (booking) / GH₵100 owner (listing). */
export function FeeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const token = useSession((s) => s.token);
  const profile = useSession((s) => s.profile);
  const { requiredFor } = (route.params ?? {}) as { requiredFor?: "booking" | "listing" };

  const amount = profile?.role === "OWNER" ? ACCESS_FEE_GHS.OWNER : ACCESS_FEE_GHS.STUDENT;
  const [provider, setProvider] = useState<PaymentProvider>("MTN_MOMO");
  const [phone, setPhone] = useState("+233");
  const [reference, setReference] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (!token) {
      setError("Log in first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = (await api.initiateAccessFee(token, { provider, phone })) as {
        exempt?: boolean;
        accessFee?: { reference: string };
        authorizationUrl?: string;
        prompt?: string;
      };
      if (res.exempt) {
        setPaid(true);
        return;
      }
      setReference(res.accessFee?.reference ?? null);
      setAuthUrl(res.authorizationUrl ?? null);
      if (res.authorizationUrl) Linking.openURL(res.authorizationUrl).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payment");
    } finally {
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    if (!token || !reference) return;
    setChecking(true);
    setError(null);
    try {
      const res = (await api.accessFeeStatus(token, reference)) as { status: string };
      if (res.status === "success") setPaid(true);
      else setError("Still pending — approve the prompt, then check again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status check failed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Onboarding fee</Title>
        <Sub>One-time {ghs(amount)} · unlocks {requiredFor === "listing" ? "publishing listings" : "booking rooms"} forever.</Sub>

        {paid ? (
          <Card style={{ marginTop: 16, borderColor: "#16A34A" }}>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>✓ Unlocked</Text>
            <Text style={{ marginTop: 6 }}>Your fee is paid. Go back and continue{requiredFor === "listing" ? " publishing" : " booking"}.</Text>
            <View style={{ marginTop: 12 }}>
              <PrimaryButton title="← Back" onPress={() => navigation.goBack()} />
            </View>
          </Card>
        ) : reference ? (
          <>
            <Card style={{ marginTop: 16, backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }}>
              <Text>🔒 Freizy holds this fee. Reference: {reference}</Text>
              <Sub>{authUrl ? "Complete payment in the browser page we opened, then check status." : `Approve the prompt on ${phone}, then check status.`}</Sub>
            </Card>
            <ErrorText message={error} />
            <View style={{ marginTop: 16 }}>
              <PrimaryButton title="I've approved — check status" onPress={checkStatus} loading={checking} tone="dark" />
            </View>
          </>
        ) : (
          <>
            <Text style={{ fontWeight: "800", marginTop: 16, marginBottom: 8, fontSize: 16 }}>Pay with</Text>
            <View style={{ flexDirection: "row" }}>
              {PROVIDERS.map((p) => (
                <Chip key={p.id} label={p.label} on={provider === p.id} dark onPress={() => setProvider(p.id)} />
              ))}
            </View>
            {provider !== "CARD" && (
              <View style={{ marginTop: 12 }}>
                <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+233201234567" />
              </View>
            )}
            <Card style={{ marginTop: 12, backgroundColor: "#F8F8F8" }}>
              <Text>Due now: <Text style={{ fontWeight: "800" }}>{ghs(amount)}</Text> (one-time, non-refundable)</Text>
            </Card>
            <ErrorText message={error} />
            <View style={{ marginTop: 16 }}>
              <PrimaryButton title={`Pay ${ghs(amount)} →`} onPress={start} loading={busy} />
            </View>
          </>
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </Screen>
  );
}
