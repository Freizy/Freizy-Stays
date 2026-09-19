import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Badge, Card, Empty, ErrorText, GhostButton, PrimaryButton, Screen, Title, ghs } from "../components/ui";
import { theme } from "../theme";
import { api } from "../services/api";
import { useSession } from "../store/session";

export function AdminScreen() {
  const token = useSession((s) => s.token);
  const [hostels, setHostels] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [h, b] = await Promise.all([
        api.hostels(token) as Promise<{ data: any[] }>,
        api.adminBookings(token) as Promise<any[]>,
      ]);
      setHostels(h.data ?? []);
      setBookings(b ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load admin data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleVerify = async (id: string, current: boolean) => {
    if (!token) return;
    setActing(`verify:${id}`);
    try {
      await api.verifyHostel(token, id, !current);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setActing(null);
    }
  };

  const release = async (id: string) => {
    if (!token) return;
    setActing(`release:${id}`);
    try {
      await api.releaseEscrow(token, id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Release failed (student must confirm move-in first)");
    } finally {
      setActing(null);
    }
  };

  if (!token) {
    return (
      <Screen>
        <Title>Admin</Title>
        <Empty>Log in as an admin.</Empty>
      </Screen>
    );
  }

  const held = bookings.filter((b) => b.escrowStatus === "held").reduce((s, b) => s + (b.paidAmount ?? 0), 0);
  const released = bookings.filter((b) => b.escrowStatus === "released").reduce((s, b) => s + (b.paidAmount ?? 0), 0);
  const unverified = hostels.filter((h) => !h.isVerified);
  const releasable = bookings.filter((b) => b.status === "moved_in" && b.escrowStatus === "held");

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Admin</Title>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <Card style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>{bookings.length}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Bookings</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>{ghs(held)}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>In escrow</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>{unverified.length}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>To verify</Text>
          </Card>
        </View>

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Verify hostels</Text>
        {unverified.length === 0 && !loading && <Empty>All hostels verified. 🎉</Empty>}
        {[...unverified, ...hostels.filter((h) => h.isVerified)].map((h) => (
          <Card key={h.id} style={{ marginTop: 10 }}>
            <Text style={{ fontWeight: "700" }}>{h.name}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{h.location} · {ghs(h.pricePerSemester ?? 0)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <Badge tone={h.isVerified ? "verified" : "pending"}>{h.isVerified ? "✓ Verified" : "⏳ Unverified"}</Badge>
              <View style={{ width: 130 }}>
                {acting === `verify:${h.id}` ? (
                  <ActivityIndicator />
                ) : h.isVerified ? (
                  <GhostButton title="Unverify" onPress={() => toggleVerify(h.id, true)} />
                ) : (
                  <PrimaryButton title="Verify ✓" onPress={() => toggleVerify(h.id, false)} />
                )}
              </View>
            </View>
          </Card>
        ))}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Release escrow ({releasable.length})</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Moved-in + confirmed bookings awaiting payout.</Text>
        {releasable.length === 0 && !loading && <Empty>Nothing to release. Released so far: {ghs(released)}.</Empty>}
        {releasable.map((b) => (
          <Card key={b.id} style={{ marginTop: 10 }}>
            <Text style={{ fontWeight: "700" }}>{b.hostel?.name ?? b.hostelId}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {b.student?.phone ?? b.student?.email} · {ghs(b.paidAmount ?? 0)} held
            </Text>
            <View style={{ marginTop: 8 }}>
              {acting === `release:${b.id}` ? (
                <ActivityIndicator />
              ) : (
                <PrimaryButton title={`Release ${ghs(b.paidAmount ?? 0)} →`} onPress={() => release(b.id)} />
              )}
            </View>
          </Card>
        ))}
        <ErrorText message={error} />
        {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}
