import React, { useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { MUST_HAVES } from "@freizy-stays/shared";
import { Chip, ErrorText, Field, Input, PrimaryButton, Screen, Sub, Title } from "../components/ui";
import { SchoolPicker } from "../components/SchoolPicker";
import { api } from "../services/api";
import { uploadHostelMedia } from "../services/media";
import { useSession } from "../store/session";

export function AddHostelScreen() {
  const navigation = useNavigation<any>();
  const token = useSession((s) => s.token);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [school, setSchool] = useState("Legon");
  const [price, setPrice] = useState("2500");
  const [amenities, setAmenities] = useState<string[]>(["WiFi", "Water 24/7"]);
  const [agentFee, setAgentFee] = useState(false);
  const [momoAllowed, setMomoAllowed] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAmenity = (a: string) => setAmenities((m) => (m.includes(a) ? m.filter((x) => x !== a) : [...m, a]));

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
      });
      navigation.goBack();
    } catch (e) {
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

        <Field label="Nearest school">
          <SchoolPicker value={school} dark onChange={setSchool} />
        </Field>

        <Field label="Price per semester (GH₵)">
          <Input value={price} onChangeText={setPrice} keyboardType="number-pad" />
        </Field>

        <Field label="Amenities">
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {MUST_HAVES.map((a) => (
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
