import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api } from "./api";

/** Foreground display config + Android channel + tap routing. Call once. */
export function setupPushListeners(onTap: (tab: string) => void) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "Freizy updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => undefined);
  }
  return Notifications.addNotificationResponseReceivedListener((resp) => {
    const tab = resp.notification.request.content.data?.tab;
    if (typeof tab === "string") onTap(tab);
  });
}

/** Ask permission, get Expo push token, save to API. Silent no-op on failure. */
export async function registerPushToken(token: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    const finalStatus = existing === "granted" ? existing : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== "granted") return;
    const expoToken = (await Notifications.getExpoPushTokenAsync()).data;
    if (expoToken) await api.savePushToken(token, expoToken);
  } catch {
    /* push unavailable (simulator, offline) */
  }
}
