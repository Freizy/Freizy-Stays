import React, { useEffect, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker } from "react-native-maps";
import { HOSTEL_AMENITIES } from "@freizy-stays/shared";
import { Chip, ErrorText, Field, GhostButton, Input, PrimaryButton, Screen, Sub, Title } from "../components/ui";
import { SchoolPicker } from "../components/SchoolPicker";
import { api } from "../services/api";
import { uploadHostelMedia } from "../services/media";
import { useSession } from "../store/session";

export function AddHostelScreen() {  const navigation = useNavigation<any>();
  const token = useSession((s) => s.token);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [school, setSchool] = useState("Legon");
  const [price, setPrice] = useState("2500");
  const [amenities, setAmenities] = useState<string[]>(["WiFi", "Water 24/7"]);
  const [agentFee, setAgentFee] = useState(false);
  const [momoAllowed, setMomoAllowed] = useState(true);
  const [roomTypes, setRoomTypes] = useState([
    { kind: "single" as const, capacity: 1, total: 2, price: "" },
    { kind: "shared" as const, capacity: 2, total: 0, price: "" },
    { kind: "shared" as const, capacity: 3, total: 0, price: "" },
    { kind: "shared" as const, capacity: 4, total: 6, price: "" },
  ]);
  const setRoom = (i: number, patch: Partial<(typeof roomTypes)[number]>) =>
    setRoomTypes((r) => r.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const [lightScore, setLightScore] = useState<number | null>(null);
  const [waterScore, setWaterScore] = useState<number | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAmenity = (a: string) => setAmenities((m) => (m.includes(a) ? m.filter((x) => x !== a) : [...m, a]));

function ScoreRow({ label, icon, value, onChange }: { label: string; icon: string; value: number | null; onChange: (v: number | null) => void }) {
  const step = (d: number) => {
    const base = value == null ? 4 : value;
    onChange(Math.min(5, Math.max(0, Math.round((base + d) * 10) / 10)));
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
      <Text style={{ fontWeight: "700" }}>{icon} {label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => step(-0.5)} style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "800" }}>−</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: "800", fontSize: 16, minWidth: 52, textAlign: "center" }}>{value == null ? "—" : `${value}/5`}</Text>
        <TouchableOpacity onPress={() => step(0.5)} style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "800" }}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [schools, setSchools] = useState<{ name: string; latitude: number; longitude: number }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        setSchools((await api.listSchools()) as { name: string; latitude: number; longitude: number }[]);
      } catch {
        /* offline */
      }
    })();
  }, []);

  const la = Number(lat);
  const ln = Number(lng);
  const pin = lat.trim() !== "" && lng.trim() !== "" && Number.isFinite(la) && Number.isFinite(ln) ? { latitude: la, longitude: ln } : null;
  const schoolPin = schools.find((s) => s.name === school);
  const setPin = (plat: number, plng: number) => {
    setLat(String(Math.round(plat * 1e6) / 1e6));
    setLng(String(Math.round(plng * 1e6) / 1e6));
  };
  const useSchoolPin = () => {
    if (schoolPin) setPin(schoolPin.latitude, schoolPin.longitude);
  };

  const pickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission denied.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 8,
      quality: 0.7,
    });
    if (res.canceled) return;
    setError(null);
    for (const [i, asset] of res.assets.entries()) {
      try {
        setUploading(`Uploading photo ${photos.length + i + 1}…`);
        const url = await uploadHostelMedia(asset.uri, "photos");
        setPhotos((p) => [...p, url]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Photo upload failed");
        break;
      }
    }
    setUploading(null);
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission denied.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], quality: 0.7 });
    if (res.canceled) return;
    setError(null);
    try {
      setUploading("Uploading video… (30s max)");
      setVideoUrl(await uploadHostelMedia(res.assets[0].uri, "videos"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video upload failed");
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    if (!token) {
      setError("Log in as an owner first.");
      return;
    }
    const priceNum = Number(price);
    if (name.trim().length < 2) return setError("Enter a hostel name.");
    if (location.trim().length < 2) return setError("Enter the location.");
    if (!Number.isFinite(priceNum) || priceNum <= 0) return setError("Enter a valid price per semester.");
    if (photos.length < 5) return setError(`Add at least 5 photos (${photos.length}/5).`);
    const rooms = roomTypes
      .filter((t) => t.total > 0)
      .map((t) => ({
        kind: t.kind,
        capacity: t.capacity,
        total: t.total,
        ...(t.price.trim() ? { price: Number(t.price) } : {}),
      }));
    if (!rooms.length) return setError("Add at least 1 room (set a count above 0).");
    for (const t of rooms) {
      if (t.price != null && (!Number.isFinite(t.price) || t.price <= 0)) return setError("Room prices must be positive numbers.");
    }
    let coords: { latitude: number; longitude: number } | null = null;
    if (lat.trim() !== "" || lng.trim() !== "") {
      if (!pin || la < -90 || la > 90 || ln < -180 || ln > 180) {
        return setError("Enter a valid map pin (latitude -90…90, longitude -180…180).");
      }
      coords = pin;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createHostel(token, {
        name: name.trim(),
        location: location.trim(),
        pricePerSemester: Math.round(priceNum),
        images: photos,
        ...(videoUrl ? { videoUrl } : {}),
        amenities,
        agentFee,
        momoAllowed,
        school,
        ...(coords ? coords : {}),
        ...(lightScore != null ? { lightScore } : {}),
        ...(waterScore != null ? { waterScore } : {}),
        roomTypes: rooms,
      });
      navigation.goBack();
    } catch (e) {
      if ((e as { code?: string })?.code === "ACCESS_FEE_REQUIRED") {
        navigation.navigate("AccessFee", { requiredFor: "listing" });
        return;
      }
      setError(e instanceof Error ? e.message : "Could not create listing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Add hostel</Title>
        <Sub>Listings go live instantly — Freizy verifies them for the green badge.</Sub>

        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="e.g. East Legon Heights" />
        </Field>

        <Field label="Location">
          <Input value={location} onChangeText={setLocation} placeholder="e.g. Madina, Accra" />
        </Field>

        <Field label="Map pin (for accurate placement)">
          <View style={{ height: 180, borderRadius: 12, overflow: "hidden", backgroundColor: "#F0F0F0" }}>
            <MapView
              key={`map-${school}`}
              style={{ flex: 1 }}
              initialRegion={{
                ...(pin ?? (schoolPin ? { latitude: schoolPin.latitude, longitude: schoolPin.longitude } : { latitude: 5.6037, longitude: -0.187 })),
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onPress={(e: any) => setPin(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
            >
              {pin && <Marker coordinate={pin} draggable onDragEnd={(e: any) => setPin(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)} />}
            </MapView>
          </View>
          <Text style={{ color: "#666", fontSize: 12, marginTop: 6 }}>Tap the map or drag the pin. Tip: long-press a spot in Google Maps to read coordinates.</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Input value={lat} onChangeText={setLat} keyboardType="decimal-pad" placeholder="Latitude e.g. 5.6502" />
            </View>
            <View style={{ flex: 1 }}>
              <Input value={lng} onChangeText={setLng} keyboardType="decimal-pad" placeholder="Longitude e.g. -0.1867" />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <GhostButton title={`📍 Use ${school} location`} onPress={useSchoolPin} />
            </View>
            {pin && <Text style={{ fontSize: 12, color: "#666" }}>📌 {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}</Text>}
          </View>
        </Field>

        <Field label="Nearest school">
          <SchoolPicker value={school} dark onChange={setSchool} />
        </Field>

        <Field label="Price per semester (GH₵)">
          <Input value={price} onChangeText={setPrice} keyboardType="number-pad" />
        </Field>

        <Field label={`Amenities (${amenities.length} selected)`}>
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

        <Field label="Rooms & types">
          <Text style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>Counts per type. Prices optional — blank means the hostel price above.</Text>
          {roomTypes.map((t, i) => (
            <View key={`${t.kind}-${t.capacity}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontWeight: "700", flex: 1 }}>{t.kind === "single" ? "Single" : `Shared (${t.capacity})`}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity onPress={() => setRoom(i, { total: Math.max(0, t.total - 1) })} style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800" }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontWeight: "800", fontSize: 16, minWidth: 26, textAlign: "center" }}>{t.total}</Text>
                <TouchableOpacity onPress={() => setRoom(i, { total: Math.min(50, t.total + 1) })} style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800" }}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {roomTypes.map((t, i) => (
              <View key={`p-${t.kind}-${t.capacity}`} style={{ width: "48%" }}>
                <Input value={t.price} onChangeText={(v) => setRoom(i, { price: v })} keyboardType="number-pad" placeholder={`${t.kind === "single" ? "Single" : `Shared ${t.capacity}`} GH₵`} />
              </View>
            ))}
          </View>
        </Field>

        <Field label="Water & light scores">
          <Text style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>How tenants will see it on day one — real ratings update it later.</Text>
          <ScoreRow label="Water" icon="💧" value={waterScore} onChange={setWaterScore} />
          <ScoreRow label="Light" icon="⚡" value={lightScore} onChange={setLightScore} />
        </Field>

        <Field label={`Photos (${photos.length}/5 min)`}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {photos.map((u) => (
              <Image key={u} source={{ uri: u }} style={{ width: 100, height: 75, borderRadius: 8, marginRight: 8, marginBottom: 8 }} />
            ))}
          </View>
          <View style={{ marginTop: 4 }}>
            <PrimaryButton title="＋ Add photos" tone="dark" onPress={pickPhotos} loading={!!uploading && !videoUrl} />
          </View>
        </Field>

        <Field label="Video tour (30s, optional)">
          {videoUrl ? (
            <Text style={{ color: "#16A34A", fontWeight: "700" }}>✓ Video uploaded</Text>
          ) : (
            <PrimaryButton title="＋ Add 30s video" tone="dark" onPress={pickVideo} />
          )}
        </Field>
        {uploading && <Sub>{uploading}</Sub>}
        <ErrorText message={error} />

        <View style={{ marginTop: 20, marginBottom: 32 }}>
          <PrimaryButton title="Publish listing →" onPress={submit} loading={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}
