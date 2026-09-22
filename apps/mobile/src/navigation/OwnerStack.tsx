import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { OwnerScreen } from "../screens/MoreScreens";
import { AddHostelScreen } from "../screens/AddHostelScreen";
import { EditHostelScreen } from "../screens/EditHostelScreen";
import { FeeScreen } from "../screens/FeeScreen";

const Stack = createNativeStackNavigator();

export function OwnerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OwnerHome" component={OwnerScreen} options={{ title: "Owner" }} />
      <Stack.Screen name="AddHostel" component={AddHostelScreen} options={{ title: "Add hostel" }} />
      <Stack.Screen name="EditHostel" component={EditHostelScreen} options={{ title: "Edit listing" }} />
      <Stack.Screen name="AccessFee" component={FeeScreen} options={{ title: "Onboarding fee" }} />
    </Stack.Navigator>
  );
}
