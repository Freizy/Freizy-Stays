import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HOME_FILTER_CHIPS, type Hostel } from "@freizy-stays/shared";
import { Badge, Card, Empty, Screen } from "../components/ui";
import { theme } from "../theme";
import { api } from "../services/api";
import { useSession } from "../store/session";

const MOCK: Hostel[] = [
  {
    id: "1", ownerId: "dev", name: "East Legon Heights", location: "Legon, Accra",
    latitude: 5.644, longitude: -0.161, distanceToCampusKm: 0.8, pricePerSemester: 3500,
    images: [], videoUrl: null, amenities: ["WiFi", "Water 24/7"], isVerified: true,
    lightScore: 4.5, waterScore: 4.8, agentFee: false, momoAllowed: true, school: "Legon",
  },
  {
    id: "2", ownerId: "dev", name: "Fordjour House", location: "Okponglo, Legon",
    latitude: 6.674, longitude: -1.574, distanceToCampusKm: 1.2, pricePerSemester: 2800,
    images: [], videoUrl: null, amenities: ["WiFi"], isVerified: false,
    lightScore: 4.0, waterScore: 4.2, agentFee: true, momoAllowed: true, school: "KNUST",
  },
];

const CHIP_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; lines: [string, string] }> = {
  "Verified Only": { icon: "checkmark-circle", lines: ["Verified", "Only"] },
  "No Agent Fee": { icon: "pricetag", lines: ["No Agent", "Fee"] },
  "MoMo Installment": { icon: "calendar", lines: ["MoMo", "Installment"] },
  "Close to Campus": { icon: "location", lines: ["Close to", "Campus"] },
  "Under GH₵3000": { icon: "cash", lines: ["Under", "GH₵3000"] },
};

function buildQuery(active: string[], q: string): string {
  const p = new URLSearchParams();
  if (active.includes("Verified Only")) p.set("verifiedOnly", "true");
  if (active.includes("No Agent Fee")) p.set("noAgentFee", "true");
  if (active.includes("MoMo Installment")) p.set("momo", "true");
  if (active.includes("Under GH₵3000")) p.set("maxPrice", "3000");
  if (q.trim()) p.set("search", q.trim());
  const s = p.toString();
  return s ? `?${s}` : "";
}

function accentFor(h: Hostel): string | null {
  if (h.momoAllowed) return "Pay with MoMo";
  if (!h.agentFee) return "No Agent Fee";
  if (h.pricePerSemester < 3000) return "Under GH₵3000";
  if (h.isVerified) return "Freizy Verified";
  return null;
}

export function HomeScreen({ onSelect }: { onSelect?: (h: Hostel) => void }) {
  const token = useSession((s) => s.token);
  const profile = useSession((s) => s.profile);
  const [active, setActive] = useState<string[]>(["Verified Only"]);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Hostel[]>(MOCK);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!token) {
      setItems(MOCK);
      setLive(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = (await api.hostels(token, buildQuery(active, q))) as { data: Hostel[] };
        let list = res.data ?? [];
        if (active.includes("Close to Campus")) list = list.filter((h) => (h.distanceToCampusKm ?? 99) <= 2);
        setItems(list);
        setLive(true);
      } catch {
        setItems(MOCK);
        setLive(false);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [token, active, q]);

  const school = profile?.school ?? "Legon";

  return (
    <Screen pad={false} style={{ paddingHorizontal: 16, paddingTop: 2 }}>
      <Text style={{ textAlign: "center", fontSize: 22, fontWeight: "900", letterSpacing: 2, fontFamily: theme.fontFamily.display }}>
        FREIZY <Text style={{ color: theme.colors.primary }}>STAYS</Text>
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F2", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, marginTop: 14 }}>
        <Text style={{ fontSize: 16, marginRight: 8 }}>✨</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Find hostel near Legon wey get light and water..."
          placeholderTextColor="#999"
          style={{ flex: 1, fontSize: 14, color: "#333" }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {HOME_FILTER_CHIPS.map((c) => {
            const on = active.includes(c);
            const meta = CHIP_META[c];
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setActive(on ? active.filter((x) => x !== c) : [...active, c])}
                style={{
                  width: 72,
                  backgroundColor: on ? "#FDECEC" : "#F5F5F5",
                  borderWidth: 1.5,
                  borderColor: on ? theme.colors.primary : "#E0E0E0",
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Ionicons name={meta.icon} size={22} color={on ? theme.colors.primary : "#8E8E93"} />
                <Text style={{ color: on ? theme.colors.primary : "#666", fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 4 }}>
                  {meta.lines[0]}{"\n"}{meta.lines[1]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Text style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 10 }}>
        Showing hostels near {school} • Accra, Ghana • <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{live ? "Updated just now" : "offline sample"}</Text>
      </Text>

      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          showsVerticalScrollIndicator={false}
          style={{ marginTop: 12 }}
          ListEmptyComponent={<Empty>No hostels match — try loosening a filter.</Empty>}
          ListFooterComponent={
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingTop: 12, paddingBottom: 28 }}>
              <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 5, borderWidth: 1, borderColor: "#EEE" }}>
                <Image source={require("../../assets/logo2.png")} style={{ width: 26, height: 26 }} resizeMode="contain" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: "#999", fontSize: 12, fontWeight: "700" }}>© 2026 Freizy Technologies</Text>
                <Text style={{ color: "#BBB", fontSize: 11 }}>Intelligence Finds You Home</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const accent = accentFor(item);
            const photo = item.images[0];
            return (
              <TouchableOpacity onPress={() => onSelect?.(item)} activeOpacity={0.7}>
                <Card style={{ marginBottom: 14, padding: 12 }}>
                  <View style={{ flexDirection: "row" }}>
                    <View style={{ width: 112, height: 112, borderRadius: 12, overflow: "hidden", backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" }}>
                      {photo ? (
                        <Image source={{ uri: photo }} style={{ width: 112, height: 112 }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontSize: 36 }}>🏢</Text>
                      )}
                      {item.isVerified && (
                        <View style={{ position: "absolute", top: 6, left: 6, backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, flexDirection: "row", alignItems: "center" }}>
                          <Text style={{ color: "#16A34A", fontWeight: "800", fontSize: 11 }}>✓ </Text>
                          <Text style={{ color: "#16A34A", fontWeight: "800", fontSize: 10 }}>Freizy Verified</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, paddingLeft: 12, justifyContent: "center" }}>
                      <Text style={{ fontWeight: "800", fontSize: 17 }} numberOfLines={1}>{item.name}</Text>
                      <Text style={{ color: "#666", fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                        📍 {item.distanceToCampusKm != null ? `${item.distanceToCampusKm} km • ` : ""}{item.location}
                      </Text>
                      <Text style={{ fontWeight: "800", fontSize: 16, marginTop: 6 }}>
                        GH₵{item.pricePerSemester.toLocaleString()}/sem
                        {!!accent && <Text style={{ color: theme.colors.primary, fontWeight: "600", fontSize: 13 }}> • {accent}</Text>}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                        {item.lightScore != null && <Text style={{ fontSize: 13 }}>⚡ Light: {item.lightScore}/5</Text>}
                        {item.waterScore != null && <Text style={{ fontSize: 13 }}>💧 Water: {item.waterScore}/5</Text>}
                      </View>
                    </View>
                  </View>
                  {!item.isVerified && (
                    <View style={{ marginTop: 8 }}>
                      <Badge tone="muted">Unverified</Badge>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </Screen>
  );
}
