import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HOME_FILTER_CHIPS, SCHOOL_CITY, type Hostel } from "@freizy-stays/shared";
import { Badge, Card, Chip, Empty, Input, Screen, ghs } from "../components/ui";
import { theme } from "../theme";
import { api } from "../services/api";
import { useSession } from "../store/session";

export const MOCK: Hostel[] = [
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

function buildQuery(active: string[], q: string, preferSchool?: string): string {
  const p = new URLSearchParams();
  if (active.includes("Verified Only")) p.set("verifiedOnly", "true");
  if (active.includes("No Agent Fee")) p.set("noAgentFee", "true");
  if (active.includes("MoMo Installment")) p.set("momo", "true");
  if (active.includes("Under GH₵3000")) p.set("maxPrice", "3000");
  if (preferSchool) p.set("preferSchool", preferSchool);
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
  const [recents, setRecents] = useState<string[]>([]);
  const [applied, setApplied] = useState<{ maxPrice?: number; school?: string; amenities?: string[]; noAgentFee?: boolean; verifiedOnly?: boolean; momoOnly?: boolean; closeToCampus?: boolean } | null>(null);

  const saveRecent = () => {
    const t = q.trim();
    if (!t) return;
    setRecents((r) => [t, ...r.filter((x) => x !== t)].slice(0, 5));
  };

  const [notices, setNotices] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const list = (await api.listAnnouncements(profile?.role ?? "ALL")) as any[];
        setNotices((list ?? []).slice(0, 3));
      } catch {
        /* offline */
      }
    })();
  }, [profile?.role]);

  useEffect(() => {
    if (!token) {
      setItems(MOCK);
      setLive(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = (await api.hostels(token, buildQuery(active, q, profile?.school ?? undefined))) as { data: Hostel[]; applied?: { maxPrice?: number; school?: string; amenities?: string[]; noAgentFee?: boolean; verifiedOnly?: boolean; momoOnly?: boolean; closeToCampus?: boolean } };
        let list = res.data ?? [];
        if (active.includes("Close to Campus")) list = list.filter((h) => (h.distanceToCampusKm ?? 99) <= 2);
        setItems(list);
        setApplied(res.applied ?? null);
        setLive(true);
      } catch {
        setItems(MOCK);
        setApplied(null);
        setLive(false);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [token, active, q, profile?.school]);

  const school = profile?.school ?? "Legon";
  const hintParts: string[] = [];
  if (applied?.school) hintParts.push(applied.school);
  if (applied?.maxPrice != null) hintParts.push(`under ${ghs(applied.maxPrice)}`);
  if (applied?.amenities?.length) hintParts.push(applied.amenities.join(", "));
  if (applied?.noAgentFee) hintParts.push("No agent fee");
  if (applied?.verifiedOnly) hintParts.push("Verified");
  if (applied?.momoOnly) hintParts.push("MoMo");
  if (applied?.closeToCampus) hintParts.push("Close to campus");
  const hintsText = hintParts.length ? `🔍 Understood: ${hintParts.join(" · ")}` : "";

  return (
    <Screen pad={false} style={{ paddingHorizontal: 16, paddingTop: 2 }}>
      <Text style={{ textAlign: "center", fontSize: 22, fontWeight: "900", letterSpacing: 2, fontFamily: theme.fontFamily.display }}>
        FREIZY <Text style={{ color: theme.colors.primary }}>STAYS</Text>
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F2", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>✨</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Find hostel near Legon wey get light and water..."
            placeholderTextColor="#999"
            onSubmitEditing={saveRecent}
            returnKeyType="search"
            style={{ flex: 1, fontSize: 14, color: "#333" }}
          />
        </View>
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")} style={{ marginLeft: 8, backgroundColor: "#F0F0F0", borderRadius: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, color: "#666" }}>×</Text>
          </TouchableOpacity>
        )}
      </View>
      {q === "" && recents.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          <Text style={{ color: "#999", fontSize: 12, width: "100%", marginBottom: 4 }}>Recent:</Text>
          {recents.map((r) => (
            <TouchableOpacity key={r} onPress={() => setQ(r)} style={{ backgroundColor: "#F5F5F5", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: "#555" }}>🕘 {r.length > 28 ? `${r.slice(0, 28)}…` : r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 12 }}>
        {HOME_FILTER_CHIPS.map((c) => {
          const on = active.includes(c);
          const meta = CHIP_META[c];
          return (
            <TouchableOpacity
              key={c}
              onPress={() => setActive(on ? active.filter((x) => x !== c) : [...active, c])}
              style={{
                flex: 1,
                height: 68,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: on ? "#FDECEC" : "#F5F5F5",
                borderWidth: 1.5,
                borderColor: on ? theme.colors.primary : "#E0E0E0",
                borderRadius: 12,
                paddingVertical: 8,
              }}
            >
              <Ionicons name={meta.icon} size={20} color={on ? theme.colors.primary : "#8E8E93"} />
              <Text style={{ color: on ? theme.colors.primary : "#666", fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 4 }}>
                {meta.lines[0]}{"\n"}{meta.lines[1]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ textAlign: "center", fontSize: 12, color: "#666", marginBottom: -3}}>
        Showing hostels near {school} • {SCHOOL_CITY[school] ?? "Ghana"}, Ghana • <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{live ? "Updated just now" : "offline sample"}</Text>
      </Text>
      <Text style={{ textAlign: "center", fontSize: 12, color: theme.colors.primary, marginTop: 2, minHeight: 16 }}>
        {hintsText || " "}
      </Text>
      {notices.length > 0 && (
        <View style={{ marginTop: 8 }}>
          {notices.map((n) => (
            <Card key={n.id} style={{ marginBottom: 8, backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }}>
              <Text style={{ fontWeight: "800", fontSize: 13 }}>📢 {n.title}</Text>
              <Text style={{ fontSize: 13, color: "#555" }}>{n.body}</Text>
            </Card>
          ))}
        </View>
      )}

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
                <Text style={{ color: "#BBB", fontSize: 11 }}>Powering a Smarter Connected Tomorrow </Text>
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
