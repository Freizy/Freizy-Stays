import { createNavigationContainerRef } from "@react-navigation/native";

/** Root navigator ref — the only reliable way to jump between tabs + stacks. */
export const navigationRef = createNavigationContainerRef<any>();

function isReady(): boolean {
  try {
    return navigationRef.isReady();
  } catch {
    return false;
  }
}

/** Main > Home tab > HostelDetail. Works from anywhere when logged in. */
export function goHomeDetail(hostelId: string, hostel: unknown): void {
  if (!isReady()) return;
  navigationRef.navigate("Main", {
    screen: "Home",
    params: { screen: "HostelDetail", params: { hostelId, hostel } },
  });
}

/** Main > Explore tab, optionally opening directions to a hostel. */
export function goExploreDirections(hostel?: unknown): void {
  if (!isReady()) return;
  navigationRef.navigate("Main", {
    screen: "Explore",
    params: hostel ? { directionsTo: hostel } : undefined,
  });
}

/** Main > plain tab (Bookings, Owner, Home). */
export function goTab(tab: string): void {
  if (!isReady()) return;
  navigationRef.navigate("Main", { screen: tab });
}
