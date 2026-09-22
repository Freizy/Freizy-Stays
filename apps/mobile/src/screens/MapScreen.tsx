import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import type { Hostel } from "@freizy-stays/shared";
import { MOCK } from "./HomeScreen";
import { Badge, Empty, Screen, ghs } from "../components/ui";
import { theme } from "../theme";
import { api } from "../services/api";
import { useSession } from "../store/session";
import { goHomeDetail } from "../services/navigation";

const LEGON = { latitude: 5.65, longitude: -0.18, latitudeDelta: 0.14, longitudeDelta: 0.14 };
const CAMPUS_GATE = { latitude: 5.6502, longitude: -0.1845 };

interface LatLng {
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  coords: LatLng[];
  origin: LatLng;
  km: number;
  mins: number;
  fromLabel: string;
}

/** Free OSRM routing (no API key). Coordinates out as {latitude, longitude}. */
async function fetchRoute(from: LatLng, to: LatLng): Promise<{ coords: LatLng[]; km: number; mins: number }> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`route ${res.status}`);
  const body = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[] };
  const r = body.routes?.[0];
  if (!r) throw new Error("no route");
  return {
    coords: r.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    km: r.distance / 1000,
    mins: Math.max(1, Math.round(r.duration / 60)),
  };
}

export function MapScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const token = useSession((s) => s.token);
  const mapRef = useRef<MapView>(null);
  const [pins, setPins] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeErr, setRouteErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Hostel | null>(null);

  const directionsTo = (route.params as { directionsTo?: Hostel } | undefined)?.directionsTo;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = (await api.hostels(token, "")) as { data: Hostel[] };
      const list = (res.data ?? []).filter((h) => h.latitude != null && h.longitude != null);
      setPins(list.length ? list : MOCK);
    } catch {
      setPins(MOCK);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const buildRoute = useCallback(async (h: Hostel) => {
    if (h.latitude == null || h.longitude == null) {
      setRouteErr("This listing has no map pin yet.");
      return;
    }
    const dest = { latitude: h.latitude, longitude: h.longitude };
    setRouting(true);
    setRouteErr(null);
    setRouteInfo(null);
    try {
      let from: LatLng = CAMPUS_GATE;
      let label = "campus gate";
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          from = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          label = "your location";
        }
      } catch {
        /* fall back to campus gate */
      }
      const r = await fetchRoute(from, dest);
      setRouteInfo({ ...r, origin: from, fromLabel: label });
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([from, dest], {
          edgePadding: { top: 110, right: 50, bottom: 70, left: 50 },
          animated: true,
        });
      }, 400);
    } catch {
      setRouteErr("Couldn't build driving directions right now.");
    } finally {
      setRouting(false);
    }
  }, []);

  const goToDetail = (h: Hostel) => goHomeDetail(h.id, h);

  useFocusEffect(
    useCallback(() => {
      refresh();
      setSelected(directionsTo ?? null);
      if (directionsTo) buildRoute(directionsTo);
      else {
        setRouteInfo(null);
        setRouteErr(null);
      }
    }, [refresh, buildRoute, directionsTo?.id])
  );

  const clearDirections = () => {
    navigation.setParams({ directionsTo: undefined });
    setRouteInfo(null);
    setRouteErr(null);
  };

  return (
    <Screen pad={false}>
      <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={LEGON}>
        {pins.map((h) => {
          const coord = { latitude: h.latitude as number, longitude: h.longitude as number };
          if (directionsTo?.id === h.id) {
            return (
              <Marker key={h.id} coordinate={coord} title={h.name} description="Destination" anchor={{ x: 0.5, y: 0.5 }} onPress={() => setSelected(h)}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#E30613", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 5 }}>
                  <Text style={{ fontSize: 22 }}>🏠</Text>
                </View>
              </Marker>
            );
          }
          return (
            <Marker
              key={h.id}
              coordinate={coord}
              title={h.name}
              description={`${ghs(h.pricePerSemester)} / semester`}
              pinColor={h.isVerified ? "#16A34A" : "#E30613"}
              onPress={() => setSelected(h)}
              onCalloutPress={() => goToDetail(h)}
            />
          );
        })}
        {routeInfo && (
          <>
            <Marker coordinate={routeInfo.origin} title="Your location" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <View style={{ position: "absolute", width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(59,130,246,0.25)" }} />
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#3B82F6", borderWidth: 3, borderColor: "#fff" }} />
              </View>
            </Marker>
            <Polyline coordinates={routeInfo.coords} strokeColor={theme.colors.primary} strokeWidth={4} />
          </>
        )}
      </MapView>
      <View style={{ position: "absolute", top: 56, left: 16, right: 16 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Badge tone="verified">● Verified</Badge>
          <Badge tone="danger">● Unverified</Badge>
          {loading ? <ActivityIndicator size="small" /> : <Text style={{ color: "#666", fontSize: 12 }}>{pins.length} on map</Text>}
        </View>
        {directionsTo && (
          <View style={{ backgroundColor: "#0A0A0A", borderRadius: 12, padding: 12, marginTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800", flex: 1 }} numberOfLines={1}>🧭 {directionsTo.name}</Text>
              <TouchableOpacity onPress={clearDirections}>
                <Text style={{ color: "#E30613", fontWeight: "700" }}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
            {routing ? (
              <ActivityIndicator color="#fff" style={{ marginTop: 8 }} />
            ) : routeInfo ? (
              <Text style={{ color: "#bbb", marginTop: 4 }}>
                {routeInfo.km.toFixed(1)} km • ~{routeInfo.mins} min drive from {routeInfo.fromLabel}
              </Text>
            ) : routeErr ? (
              <Text style={{ color: "#ff8080", marginTop: 4 }}>{routeErr}</Text>
            ) : null}
          </View>
        )}
        {pins.length === 0 && !loading && (
          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 10, marginTop: 8 }}>
            <Empty>No mapped hostels yet — listings need coordinates.</Empty>
          </View>
        )}
      </View>
      {selected && (
        <View style={{ position: "absolute", left: 16, right: 16, bottom: 24, elevation: 7, zIndex: 10 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 14, padding: 14, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "800", fontSize: 16, flex: 1 }} numberOfLines={1}>{selected.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 4 }}>
                <Text style={{ color: "#999", fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#666", fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {ghs(selected.pricePerSemester)}/sem · {selected.location}
              {selected.lightScore != null ? ` · ⚡${selected.lightScore}` : ""}
              {selected.waterScore != null ? ` · 💧${selected.waterScore}` : ""}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => buildRoute(selected)}
                style={{ flex: 1, backgroundColor: "#0A0A0A", borderRadius: 10, padding: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>🧭 Get Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => goToDetail(selected)}
                style={{ flex: 1, backgroundColor: "#F5F5F5", borderRadius: 10, padding: 12, alignItems: "center" }}
              >
                <Text style={{ fontWeight: "700" }}>View →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}
