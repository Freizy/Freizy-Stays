import React, { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { Hostel } from "@freizy-stays/shared";
import { Badge, Empty, Screen, ghs } from "../components/ui";
import { api } from "../services/api";
import { useSession } from "../store/session";

const LEGON = { latitude: 5.65, longitude: -0.18, latitudeDelta: 0.14, longitudeDelta: 0.14 };

export function MapScreen() {
  const navigation = useNavigation<any>();
  const token = useSession((s) => s.token);
  const [pins, setPins] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.hostels(token, "")) as { data: Hostel[] };
      setPins((res.data ?? []).filter((h) => h.latitude != null && h.longitude != null));
    } catch {
      /* offline: keep empty, banner below */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <Screen pad={false}>
      <MapView style={{ flex: 1 }} initialRegion={LEGON}>
        {pins.map((h) => (
          <Marker
            key={h.id}
            coordinate={{ latitude: h.latitude as number, longitude: h.longitude as number }}
            title={h.name}
            description={`${ghs(h.pricePerSemester)} / semester`}
            pinColor={h.isVerified ? "#16A34A" : "#E30613"}
            onCalloutPress={() => navigation.getParent()?.navigate("Home", { screen: "HostelDetail", params: { hostelId: h.id, hostel: h } })}
          />
        ))}
      </MapView>
      <View style={{ position: "absolute", top: 56, left: 16, right: 16 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Badge tone="verified">● Verified</Badge>
          <Badge tone="danger">● Unverified</Badge>
          {loading ? <ActivityIndicator size="small" /> : <Text style={{ color: "#666", fontSize: 12 }}>{pins.length} on map</Text>}
        </View>
        {pins.length === 0 && !loading && (
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 10, marginTop: 8 }}>
            <Empty>No mapped hostels yet — listings need coordinates.</Empty>
          </View>
        )}
      </View>
    </Screen>
  );
}
