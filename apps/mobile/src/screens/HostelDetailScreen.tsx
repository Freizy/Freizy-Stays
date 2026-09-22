import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, Share, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { Hostel } from "@freizy-stays/shared";
import { Card, Empty, PrimaryButton, Screen, distKm } from "../components/ui";
import { theme } from "../theme";
import { api } from "../services/api";
import { useSession } from "../store/session";
import { goExploreDirections } from "../services/navigation";

const SAMPLE_REVIEWS = [
  { name: "Ama K.", caption: "Clean & safe", text: "Water flows all day and light rarely goes off. Warden responds fast.", water: 5, light: 4 },
  { name: "Kwame", caption: "Great water supply", text: "WiFi is solid enough for online classes. Room was exactly like the photos.", water: 4, light: 5 },
  { name: "Efe", caption: "Nice study space", text: "No agent wahala — paid with MoMo in parts and moved in smoothly.", water: 4, light: 4 },
];

const AMENITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  WiFi: "wifi",
  "Wi-Fi": "wifi",
  "Water 24/7": "water",
  "Single room": "bed",
  "Self-contained": "home",
  "Close to campus": "location",
  Light: "flash",
  AC: "snow",
  "24/7 Security": "shield-checkmark",
  "Study Room": "book",
  Laundry: "shirt",
  Kitchen: "restaurant",
};

const CAMPUS: Record<string, string> = {
  Legon: "University of Ghana",
  KNUST: "KNUST",
  UCC: "University of Cape Coast",
  UPSA: "UPSA",
  UDS: "UDS",
};

export function HostelDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const token = useSession((s) => s.token);
  const profile = useSession((s) => s.profile);
  const { hostelId, hostel: passed } = (route.params ?? {}) as { hostelId: string; hostel?: Hostel };
  const [hostel, setHostel] = useState<Hostel | undefined>(passed);
  const [loading, setLoading] = useState(!passed);
  const [heroIdx, setHeroIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<{ count: number; waterAvg: number | null; lightAvg: number | null; ratings: any[] } | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        setHostel((await api.hostel(token, hostelId)) as Hostel);
      } catch {
        if (passed) setHostel(passed);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, hostelId]);

  useEffect(() => {
    if (!hostel) return;
    (async () => {
      try {
        setRatingSummary((await api.hostelRatings(hostel.id)) as { count: number; waterAvg: number | null; lightAvg: number | null; ratings: any[] });
      } catch {
        /* offline: samples below */
      }
    })();
  }, [hostel]);

  if (loading || !hostel) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  const perPart = Math.ceil(hostel.pricePerSemester / 4);

  const flipSuspend = async (suspended: boolean) => {
    if (!token) return;
    setActionBusy(true);
    try {
      setHostel((await api.suspendHostel(token, hostel.id, suspended)) as Hostel);
    } finally {
      setActionBusy(false);
    }
  };

  const confirmSuspend = () =>
    Alert.alert("Suspend listing?", `${hostel.name} will disappear from student and owner feeds.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Suspend", style: "destructive", onPress: () => flipSuspend(true) },
    ]);
  const photos = hostel.images ?? [];
  const hero = photos[heroIdx] ?? null;
  const campus = CAMPUS[hostel.school ?? ""] ?? hostel.school ?? "campus";
  const liveRatings = ratingSummary?.ratings ?? [];

  const share = () =>
    Share.share({
      message: `${hostel.name} — GH₵${hostel.pricePerSemester.toLocaleString()}/semester, ${hostel.location}. Found on Freizy Stays.`,
    }).catch(() => undefined);

  const openTour = () => {
    if (hostel.videoUrl) Linking.openURL(hostel.videoUrl).catch(() => undefined);
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={26} color="#111" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "900", letterSpacing: 1.5, fontFamily: theme.fontFamily.display }}>
            FREIZY <Text style={{ color: theme.colors.primary }}>STAYS</Text>
          </Text>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <TouchableOpacity onPress={share} style={{ padding: 4 }}>
              <Ionicons name="share-outline" size={24} color="#111" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSaved(!saved)} style={{ padding: 4 }}>
              <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={24} color={saved ? theme.colors.primary : "#111"} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 12, borderRadius: 16, overflow: "hidden", backgroundColor: "#F0F0F0", height: 240, justifyContent: "center", alignItems: "center" }}>
          {hero ? (
            <Image source={{ uri: hero }} style={{ width: "100%", height: 240 }} resizeMode="cover" />
          ) : (
            <Text style={{ fontSize: 56 }}>🏢</Text>
          )}
          {hostel.isVerified && (
            <View style={{ position: "absolute", left: 12, bottom: 12, backgroundColor: "#16A34A", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>✓ Freizy Verified</Text>
            </View>
          )}
          {hostel.videoUrl ? (
            <TouchableOpacity onPress={openTour} style={{ position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="videocam" size={15} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>360 Tour</Text>
            </TouchableOpacity>
          ) : (
            photos.length > 1 && (
              <View style={{ position: "absolute", right: 12, bottom: 12, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>📷 {photos.length}</Text>
              </View>
            )
          )}
        </View>

        {photos.length > 1 && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            {photos.slice(0, 5).map((u, i) => (
              <TouchableOpacity key={`${i}-${u}`} onPress={() => setHeroIdx(i)}>
                <Image
                  source={{ uri: u }}
                  style={{ width: 60, height: 48, borderRadius: 8, borderWidth: heroIdx === i ? 2 : 0, borderColor: theme.colors.primary }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 14 }}>
          <Text style={{ fontSize: 21, fontWeight: "800", flex: 1, marginRight: 8 }}>{hostel.name}</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>GH₵ {hostel.pricePerSemester.toLocaleString()}</Text>
            <Text style={{ color: "#888", fontSize: 12 }}>/semester</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {hostel.lightScore != null && (
            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ fontWeight: "700", fontSize: 13 }}>⚡ Light {hostel.lightScore}</Text>
            </View>
          )}
          {hostel.waterScore != null && (
            <View style={{ backgroundColor: "#DBEAFE", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ fontWeight: "700", fontSize: 13, color: "#1D4ED8" }}>💧 Water {hostel.waterScore}</Text>
            </View>
          )}
        </View>

        <Text style={{ color: "#555", marginTop: 10, fontSize: 14 }}>
          📍 {hostel.location}
          {distKm(hostel) != null ? ` • ${distKm(hostel)}km from ${campus}` : ""}
        </Text>
        <TouchableOpacity
          onPress={() => goExploreDirections(hostel)}
          style={{ marginTop: 10, backgroundColor: "#0A0A0A", borderRadius: 12, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Ionicons name="navigate" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700" }}>Get Directions</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 19, fontWeight: "800", marginTop: 18 }}>Amenities</Text>
        {hostel.amenities.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
            {hostel.amenities.slice(0, 6).map((a) => (
              <View key={a} style={{ width: "30%", backgroundColor: "#F5F5F5", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}>
                <Ionicons name={AMENITY_ICONS[a] ?? "checkmark-circle"} size={24} color="#333" />
                <Text style={{ fontSize: 11, marginTop: 6, textAlign: "center" }} numberOfLines={1}>{a}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: "#888", marginTop: 8 }}>No amenities listed.</Text>
        )}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <Text style={{ fontSize: 19, fontWeight: "800" }}>Video Reviews</Text>
          {ratingSummary && ratingSummary.count > 3 && (
            <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>See all {ratingSummary.count}</Text>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -16, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {SAMPLE_REVIEWS.map((r, i) => {
              const thumb = photos[(i + 1) % Math.max(photos.length, 1)] ?? null;
              return (
                <TouchableOpacity key={r.name} onPress={openTour} disabled={!hostel.videoUrl} activeOpacity={0.8} style={{ width: 140 }}>
                  <View style={{ width: 140, height: 100, borderRadius: 12, overflow: "hidden", backgroundColor: "#F0D9D9", alignItems: "center", justifyContent: "center" }}>
                    {thumb && <Image source={{ uri: thumb }} style={{ width: 140, height: 100 }} resizeMode="cover" />}
                    <View style={{ position: "absolute", width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="play" size={18} color="#fff" />
                    </View>
                  </View>
                  <Text style={{ fontWeight: "700", fontSize: 13, marginTop: 6 }}>{r.caption}</Text>
                  <Text style={{ color: "#888", fontSize: 12 }}>{r.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {liveRatings.length > 0 && (
          <View style={{ marginTop: 14 }}>
            {liveRatings.slice(0, 3).map((r: any) => (
              <Card key={r.id} style={{ marginBottom: 10 }}>
                <Text style={{ fontWeight: "700" }}>💧 {r.waterScore}/5 · ⚡ {r.lightScore}/5</Text>
                {!!r.comment && <Text style={{ marginTop: 4 }}>{r.comment}</Text>}
              </Card>
            ))}
          </View>
        )}

        {hostel.momoAllowed ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
            <View>
              <Text style={{ color: theme.colors.primary, fontWeight: "800", fontSize: 12 }}>MoMo</Text>
              <Text style={{ fontWeight: "800", fontSize: 15 }}>MoMo Installment</Text>
              <Text style={{ color: "#888", fontSize: 12 }}>Pay in 4 monthly installments</Text>
            </View>
            <Text style={{ fontWeight: "800", fontSize: 18 }}>GH₵ {perPart.toLocaleString()} × 4</Text>
          </View>
        ) : (
          <Text style={{ color: "#888", marginTop: 18 }}>Full payment only for this hostel.</Text>
        )}

        {(profile == null || profile.role === "STUDENT") && (
          <View style={{ marginTop: 14, marginBottom: 16 }}>
            <PrimaryButton title="Book Now" onPress={() => navigation.navigate("BookingFlow", { hostelId: hostel.id, hostel })} />
          </View>
        )}
        {profile?.role === "ADMIN" && (
          <View style={{ marginTop: 14, marginBottom: 16 }}>
            {hostel.suspended ? (
              <PrimaryButton title="Restore listing" tone="dark" onPress={() => flipSuspend(false)} loading={actionBusy} />
            ) : (
              <PrimaryButton title="Suspend listing" onPress={confirmSuspend} loading={actionBusy} />
            )}
          </View>
        )}
        {profile?.role === "OWNER" && <View style={{ height: 16 }} />}
      </ScrollView>
    </Screen>
  );
}
