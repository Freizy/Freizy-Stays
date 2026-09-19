const BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

async function req(path: string, token: string | null, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { message?: string }).message || `HTTP ${res.status}`);
  return res.json();
}

export const api = {
  me: (t: string) => req("/auth/me", t),
  updateMe: (t: string, body: object) => req("/auth/me", t, { method: "PATCH", body: JSON.stringify(body) }),
  savePushToken: (t: string, pushToken: string) => req("/auth/push-token", t, { method: "POST", body: JSON.stringify({ pushToken }) }),
  hostels: (t: string | null, qs = "") => req(`/hostels${qs}`, t),
  hostel: (t: string | null, id: string) => req(`/hostels/${id}`, t),
  createHostel: (t: string, body: object) => req("/hostels", t, { method: "POST", body: JSON.stringify(body) }),
  createBooking: (t: string, body: object) => req("/bookings", t, { method: "POST", body: JSON.stringify(body) }),
  myBookings: (t: string) => req("/bookings/my", t),
  initiatePayment: (t: string, body: object) => req("/payments/initiate", t, { method: "POST", body: JSON.stringify(body) }),
  myPayments: (t: string) => req("/payments/my", t),
  ownerHostels: (t: string) => req("/hostels/owner/mine", t),
  confirmMoveIn: (t: string, bookingId: string) => req(`/bookings/${bookingId}/confirm-move-in`, t, { method: "PATCH" }),
  ownerBookings: (t: string) => req("/bookings/owner", t),
  approveBooking: (t: string, bookingId: string) => req(`/bookings/${bookingId}/approve`, t, { method: "PATCH" }),
  rejectBooking: (t: string, bookingId: string) => req(`/bookings/${bookingId}/reject`, t, { method: "PATCH" }),
  paymentStatus: (t: string, reference: string) => req(`/payments/${reference}/status`, t),
  adminBookings: (t: string) => req("/admin/bookings", t),
  verifyHostel: (t: string, hostelId: string, isVerified: boolean) =>
    req(`/admin/hostels/${hostelId}/verify`, t, { method: "PATCH", body: JSON.stringify({ isVerified }) }),
  releaseEscrow: (t: string, bookingId: string) => req(`/admin/bookings/${bookingId}/release`, t, { method: "PATCH" }),
  createRating: (t: string, body: object) => req("/ratings", t, { method: "POST", body: JSON.stringify(body) }),
  hostelRatings: (hostelId: string) => req(`/ratings/hostel/${hostelId}`, null),
  createIssue: (t: string, body: object) => req("/issues", t, { method: "POST", body: JSON.stringify(body) }),
  myIssues: (t: string) => req("/issues/mine", t),
  ownerIssues: (t: string) => req("/issues/owner", t),
  resolveIssue: (t: string, issueId: string) => req(`/issues/${issueId}/resolve`, t, { method: "PATCH" }),
};
