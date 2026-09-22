import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { HOSTEL_AMENITIES, roomLabel, type Hostel, type RoomType } from "@freizy-stays/shared";
import { Chip, ErrorText, Field, Input, PrimaryButton, Screen, Title, ghs } from "../components/ui";
import { api } from "../services/api";
import { useSession } from "../store/session";

const KINDS = [
  { kind: "single", capacity: 1 },
  { kind: "shared", capacity: 2 },
  { kind: "shared", capacity: 3 },
  { kind: "shared", capacity: 4 },
] as const;

interface RowState {
  id?: string;
  kind: string;
  capacity: number;
  total: number;
  price: string;
  active: number;
  removed: boolean;
}

export function EditHostelScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const token = useSession((s) => s.token);
  const { hostelId } = route.params as { hostelId: string };

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [agentFee, setAgentFee] = useState(false);
  const [momoAllowed, setMomoAllowed] = useState(true);
  const [rows, setRows] = useState<RowState[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const h = (await api.hostel(token, hostelId)) as Hostel & { roomTypes?: (RoomType & { available?: number })[] };
        setName(h.name);
        setLocation(h.location);
        setPrice(String(h.pricePerSemester));
        setAmenities(h.amenities ?? []);
        setAgentFee(!!h.agentFee);
        setMomoAllowed(h.momoAllowed ?? true);
        setRows(
          KINDS.map((k) => {
            const ex = (h.roomTypes ?? []).find((t) => t.kind === k.kind && t.capacity === k.capacity);
            const total = ex?.total ?? 0;
            return {
              id: ex?.id,
              kind: k.kind,
              capacity: k.capacity,
              total,
              price: ex?.price != null ? String(ex.price) : "",
              active: ex ? Math.max(0, total - (ex.available ?? total)) : 0,
              removed: false,
            };
          })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load listing");
      } finally {
        setLoading(false);
      }
    })();
  }, [token, hostelId]);

  const toggleAmenity = (a: string) => setAmenities((m) => (m.includes(a) ? m.filter((x) => x !== a) : [...m, a]));
  const patchRow = (i: number, p: Partial<RowState>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const save = async () => {
    if (!token) return;
    const priceNum = Number(price);
    if (name.trim().length < 2) return setError("Enter a hostel name.");
    if (location.trim().length < 2) return setError("Enter the location.");
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError("Enter a valid price.");
    const kept = rows.filter((r) => !r.removed);
    for (const r of kept) {
      if (r.total < r.active) return setError(`${roomLabel(r)} has ${r.active} active booking(s) — can't go below that.`);
      if (r.price.trim() && (!Number.isFinite(Number(r.price)) || Number(r.price) <= 0)) {
        return setError("Room prices must be positive numbers.");
      }
    }
    setBusy(true);
    setError(null);
    try {
      await api.ownerUpdateHostel(token, hostelId, {
        name: name.trim(),
        location: location.trim(),
        pricePerSemester: Math.round(priceNum),
        amenities,
        agentFee,
        momoAllowed,
        roomTypes: kept.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          kind: r.kind,
          capacity: r.capacity,
          total: r.total,
          ...(r.price.trim() ? { price: Number(r.price) } : {}),
        })),
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Edit listing</Title>

        <Field label="Name">
          <Input value={name} onChangeText={setName} />
        </Field>
        <Field label="Location">
          <Input value={location} onChangeText={setLocation} />
        </Field>
        <Field label="Price per semester (GH₵)">
          <Input value={price} onChangeText={setPrice} keyboardType="number-pad" />
        </Field>
        <Field label="Amenities">
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {HOSTEL_AMENITIES.map((a) => (
              <Chip key={a} label={a} on={amenities.includes(a)} onPress={() => toggleAmenity(a)} />
            ))}
          </View>
        </Field>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Chip label={agentFee ? "Agent fee: yes" : "Agent fee: no"} on={agentFee} dark onPress={() => setAgentFee(!agentFee)} />
          </View>
          <View style={{ flex: 1 }}>
            <Chip label={momoAllowed ? "MoMo: on" : "MoMo: off"} on={momoAllowed} dark onPress={() => setMomoAllowed(!momoAllowed)} />
          </View>
        </View>

        <Field label="Rooms & availability">
          {rows.map((r, i) =>
            r.removed ? (
              <TouchableOpacity key={`${r.kind}-${r.capacity}`} onPress={() => patchRow(i, { removed: false })} style={{ marginTop: 8 }}>
                <Text style={{ color: "#16A34A", fontWeight: "700" }}>↩ Restore {roomLabel(r)}</Text>
              </TouchableOpacity>
            ) : (
              <View key={`${r.kind}-${r.capacity}`} style={{ borderWidth: 1, borderColor: "#EDEDED", borderRadius: 12, padding: 12, marginTop: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "800" }}>
                    {roomLabel(r)}{r.active > 0 ? ` · ${r.active} active` : ""}
                  </Text>
                  {r.id && r.active === 0 && (
                    <TouchableOpacity onPress={() => patchRow(i, { removed: true })}>
                      <Text style={{ color: "#E30613" }}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <Text>Total:</Text>
                  <TouchableOpacity
                    onPress={() => patchRow(i, { total: Math.max(r.active, r.total - 1) })}
                    style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "800" }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontWeight: "800", fontSize: 16, minWidth: 26, textAlign: "center" }}>{r.total}</Text>
                  <TouchableOpacity
                    onPress={() => patchRow(i, { total: Math.min(200, r.total + 1) })}
                    style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "800" }}>＋</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Input value={r.price} onChangeText={(v) => patchRow(i, { price: v })} keyboardType="number-pad" placeholder="GH₵ (hostel price)" />
                  </View>
                </View>
              </View>
            )
          )}
        </Field>

        <ErrorText message={error} />
        <View style={{ marginTop: 20, marginBottom: 32 }}>
          <PrimaryButton title="Save changes →" onPress={save} loading={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}
