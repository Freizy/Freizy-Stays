import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { HostelDetailScreen } from "../screens/HostelDetailScreen";
import { BookingFlowScreen } from "../screens/BookingFlowScreen";
import type { Hostel } from "@freizy-stays/shared";

const Stack = createNativeStackNavigator();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Feed" options={{ title: "Freizy Stays" }}>
        {({ navigation }: any) => (
          <HomeScreen onSelect={(h: Hostel) => navigation.navigate("HostelDetail", { hostelId: h.id, hostel: h })} />
        )}
      </Stack.Screen>
      <Stack.Screen name="HostelDetail" component={HostelDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookingFlow" component={BookingFlowScreen} options={{ title: "Booking" }} />
    </Stack.Navigator>
  );
}
