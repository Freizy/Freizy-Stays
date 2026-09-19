import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { OwnerScreen } from "../screens/MoreScreens";
import { AddHostelScreen } from "../screens/AddHostelScreen";

const Stack = createNativeStackNavigator();

export function OwnerStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="OwnerHome" component={OwnerScreen} options={{ title: "Owner" }} />
      <Stack.Screen name="AddHostel" component={AddHostelScreen} options={{ title: "Add hostel" }} />
    </Stack.Navigator>
  );
}
