import React, { useState } from "react";
import { Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ESCROW_COPY, roomLabel, type Hostel, type PaymentProvider, type RoomType } from "@freizy-stays/shared";
import { Badge, Card, Chip, ErrorText, Input, PrimaryButton, Screen, Sub, Title, ghs } from "../components/ui";
import { theme } from "../theme";
import { api } from "../services/api";
import { useSession } from "../store/session";

const PROVIDERS: { id: PaymentProvider; label: string }[] = [
  { id: "MTN_MOMO", label: "MTN MoMo" },
  { id: "VODAFONE_CASH", label: "Vodafone Cash" },
  { id: "CARD", label: "Card" },
];

interface BookingCreated {
  id: string;
  total: number;
  paidAmount: number;
  paymentType: "full" | "installment";
  status: string;
  breakdown?: { dueNow: number; plan?: string };
}

export function BookingFlowScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const token = useSession((s) => s.token);
  const { hostelId, hostel } = route.params as { hostelId: string; hostel: Hostel };

  const [plan, setPlan] = useState<"full" | "installment">("full");
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>("MTN_MOMO");
  const [phone, setPhone] = useState("+233");
  const [step, setStep] = useState<"room" | "plan" | "pay" | "done">((hostel.roomTypes?.length ? "room" : "plan") as "room" | "plan" | "pay" | "done");
  const [booking, setBooking] = useState<BookingCreated | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomTypes: (RoomType & { available?: number })[] = hostel.roomTypes ?? [];
  const selected = roomTypes.find((t) => t.id === roomTypeId) ?? roomTypes.find((t) => (t.available ?? 1) > 0) ?? null;
  const basePrice = selected?.price ?? hostel.pricePerSemester;
  const perPart = Math.ceil(basePrice / 4);
  const dueNow = plan === "full" ? basePrice : perPart;

  const lockRoom = async () => {
    if (!token) {
      setError("Log in to book first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!selected) {
        setError("Choose a room type first.");
        return;
      }
      setBooking((await api.createBooking(token, { hostelId, paymentType: plan, roomTypeId: selected.id })) as BookingCreated);
      setStep("pay");
    } catch (e) {
      if ((e as { code?: string })?.code === "ACCESS_FEE_REQUIRED") {
        navigation.navigate("AccessFee", { requiredFor: "booking" });
        return;
      }
      setError(e instanceof Error ? e.message : "Could not create booking");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!token || !booking) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await api.initiatePayment(token, { bookingId: booking.id, provider, phone })) as {
        payment: { reference: string };
        authorizationUrl?: string;
        prompt?: string;
      };
      setReference(res.payment.reference);
      setAuthUrl(res.authorizationUrl ?? null);
      if (res.authorizationUrl) Linking.openURL(res.authorizationUrl).catch(() => undefined);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed to start");
    } finally {
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    if (!token || !reference) return;
    setChecking(true);
    setError(null);
    try {
      const res = (await api.paymentStatus(token, reference)) as { status: string };
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
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
            <Ionicons name="chevron-back" size={26} color="#111" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "800", marginLeft: 4 }}>Booking</Text>
        </View>
        <Title>{hostel.name}</Title>
        <Sub>
          {ghs(hostel.pricePerSemester)} / semester · {hostel.location}
        </Sub>

        {step === "room" && (
          <>
            <Text style={{ fontWeight: "800", marginTop: 16, marginBottom: 8, fontSize: 16 }}>Choose your room</Text>
            {!roomTypes.length && (
              <Card style={{ marginBottom: 10 }}>
                <Text>No bookable rooms listed for this hostel yet.</Text>
              </Card>
            )}
            {roomTypes.map((t) => {
              const left = t.available ?? 1;
              const full = left <= 0;
              const on = selected?.id === t.id;
              return (
                <TouchableOpacity key={t.id} onPress={() => !full && setRoomTypeId(t.id)} disabled={full} activeOpacity={0.8}>
                  <Card style={{ borderWidth: 2, borderColor: on ? theme.colors.primary : "#EDEDED", marginBottom: 10, opacity: full ? 0.55 : 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontWeight: "800", fontSize: 16 }}>{roomLabel(t)} · {t.capacity} {t.capacity > 1 ? "people" : "person"}</Text>
                      <Text style={{ fontWeight: "800" }}>{ghs(t.price ?? hostel.pricePerSemester)}</Text>
                    </View>
                    <Text style={{ color: full ? theme.colors.primary : theme.colors.textMuted, marginTop: 2 }}>
                      {full ? "Full" : `${left} room${left === 1 ? "" : "s"} left`}
                    </Text>
                  </Card>
                </TouchableOpacity>
              );
            })}
            <ErrorText message={error} />
            <View style={{ marginTop: 8 }}>
              <PrimaryButton title="Continue →" onPress={() => (selected ? setStep("plan") : setError("Choose a room type first."))} />
            </View>
          </>
        )}

        {step === "plan" && (
          <>
            <Text style={{ fontWeight: "800", marginTop: 16, marginBottom: 8, fontSize: 16 }}>How do you want to pay?</Text>
            <TouchableOpacity onPress={() => setPlan("full")} activeOpacity={0.8}>
              <Card style={{ borderWidth: 2, borderColor: plan === "full" ? theme.colors.primary : "#EDEDED", marginBottom: 10 }}>
                <Text style={{ fontWeight: "800" }}>Pay Full</Text>
                <Sub>{ghs(basePrice)} now — room locked immediately{selected ? ` (${roomLabel(selected)})` : ""}</Sub>
              </Card>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => hostel.momoAllowed && setPlan("installment")} activeOpacity={0.8} disabled={!hostel.momoAllowed}>
              <Card style={{ borderWidth: 2, borderColor: plan === "installment" ? theme.colors.primary : "#EDEDED", opacity: hostel.momoAllowed ? 1 : 0.5 }}>
                <Text style={{ fontWeight: "800" }}>Pay Small (MoMo 4x)</Text>
                <Sub>
                  {hostel.momoAllowed ? `${ghs(perPart)} now to lock, then 3 more before moving` : "Not allowed for this hostel — full payment only"}
                </Sub>
              </Card>
            </TouchableOpacity>

            <Card style={{ marginTop: 12, backgroundColor: "#F8F8F8" }}>
              <Text>Due now: <Text style={{ fontWeight: "800" }}>{ghs(dueNow)}</Text></Text>
                <Text>Balance before moving: {ghs(basePrice - dueNow)}</Text>
            </Card>

            <ErrorText message={error} />
            <View style={{ marginTop: 16 }}>
              <PrimaryButton title={`Lock room — ${ghs(dueNow)} →`} onPress={lockRoom} loading={busy} />
            </View>
          </>
        )}

        {step !== "plan" && booking && (
          <>
            <Text style={{ fontWeight: "800", marginTop: 16, marginBottom: 8, fontSize: 16 }}>Pay with</Text>
            <View style={{ flexDirection: "row" }}>
              {PROVIDERS.map((p) => (
                <Chip key={p.id} label={p.label} on={provider === p.id} dark onPress={() => setProvider(p.id)} />
              ))}
            </View>

            {provider !== "CARD" && (
              <View style={{ marginTop: 8 }}>
                <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+233201234567" />
              </View>
            )}

            <Card style={{ marginTop: 12, backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }}>
              <Text>🔒 {ESCROW_COPY}</Text>
            </Card>

            <ErrorText message={error} />

            {step === "pay" && (
              <View style={{ marginTop: 16 }}>
                <PrimaryButton
                  title={`Pay ${ghs(dueNow)} with ${PROVIDERS.find((p) => p.id === provider)?.label}`}
                  onPress={pay}
                  loading={busy}
                />
              </View>
            )}

            {step === "done" && (
              <Card style={{ marginTop: 16, borderColor: paid ? theme.colors.verified : "#EDEDED" }}>
                {paid ? (
                  <>
                    <Badge tone="verified">✓ Payment confirmed</Badge>
                    <Text style={{ marginTop: 8, fontWeight: "700" }}>Room locked! Reference: {reference}</Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontWeight: "800", fontSize: 16 }}>Payment started</Text>
                    <Text style={{ marginTop: 6 }}>Reference: {reference}</Text>
                    <Sub>
                      {authUrl ? "Complete payment in the browser page we opened, then check status." : `Approve the prompt on ${phone}, then check status.`}
                    </Sub>
                  </>
                )}
                <View style={{ marginTop: 12, gap: 8 }}>
                  {!paid && <PrimaryButton title="I've approved — check status" onPress={checkStatus} loading={checking} tone="dark" />}
                  <PrimaryButton title="View in Dashboard →" onPress={() => navigation.getParent()?.navigate("Bookings")} />
                </View>
              </Card>
            )}
          </>
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </Screen>
  );
}
