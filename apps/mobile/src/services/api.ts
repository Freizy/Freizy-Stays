const BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

export const API_BASE = BASE;

async function req(path: string, token: string | null, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; detail?: string; code?: string };
    const err = new Error([body.message || `HTTP ${res.status}`, body.detail].filter(Boolean).join(" — ")) as Error & { code?: string };
    if (body.code) err.code = body.code;
    throw err;
  }
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
  ownerUpdateHostel: (t: string, hostelId: string, body: object) => req(`/hostels/mine/${hostelId}`, t, { method: "PATCH", body: JSON.stringify(body) }),
  confirmMoveIn: (t: string, bookingId: string) => req(`/bookings/${bookingId}/confirm-move-in`, t, { method: "PATCH" }),
  ownerBookings: (t: string) => req("/bookings/owner", t),
  approveBooking: (t: string, bookingId: string) => req(`/bookings/${bookingId}/approve`, t, { method: "PATCH" }),
  rejectBooking: (t: string, bookingId: string) => req(`/bookings/${bookingId}/reject`, t, { method: "PATCH" }),
  paymentStatus: (t: string, reference: string) => req(`/payments/${reference}/status`, t),
  adminBookings: (t: string) => req("/admin/bookings", t),
  releaseEscrow: (t: string, bookingId: string) => req(`/admin/bookings/${bookingId}/release`, t, { method: "PATCH" }),
  createRating: (t: string, body: object) => req("/ratings", t, { method: "POST", body: JSON.stringify(body) }),
  hostelRatings: (hostelId: string) => req(`/ratings/hostel/${hostelId}`, null),
  createIssue: (t: string, body: object) => req("/issues", t, { method: "POST", body: JSON.stringify(body) }),
  myIssues: (t: string) => req("/issues/mine", t),
  ownerIssues: (t: string) => req("/issues/owner", t),
  resolveIssue: (t: string, issueId: string) => req(`/issues/${issueId}/resolve`, t, { method: "PATCH" }),
  escalateIssue: (t: string, issueId: string) => req(`/issues/${issueId}/escalate`, t, { method: "PATCH" }),
  adminStats: (t: string) => req("/admin/stats", t),
  adminUsers: (t: string, search = "") => req(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`, t),
  setUserRole: (t: string, userId: string, role: string) => req(`/admin/users/${userId}/role`, t, { method: "PATCH", body: JSON.stringify({ role }) }),
  setUserSuspended: (t: string, userId: string, suspended: boolean) => req(`/admin/users/${userId}/suspend`, t, { method: "PATCH", body: JSON.stringify({ suspended }) }),
  verifyHostel: (t: string, hostelId: string, isVerified: boolean, checklist: string[] = []) =>
    req(`/admin/hostels/${hostelId}/verify`, t, { method: "PATCH", body: JSON.stringify({ isVerified, checklist }) }),
  adminUpdateHostel: (t: string, hostelId: string, body: object) => req(`/admin/hostels/${hostelId}`, t, { method: "PATCH", body: JSON.stringify(body) }),
  adminDeleteHostel: (t: string, hostelId: string) => req(`/admin/hostels/${hostelId}`, t, { method: "DELETE" }),
  refundBooking: (t: string, bookingId: string) => req(`/admin/bookings/${bookingId}/refund`, t, { method: "PATCH" }),
  adminPayouts: (t: string) => req("/admin/payouts", t),
  payoutMarkPaid: (t: string, payoutId: string) => req(`/admin/payouts/${payoutId}/pay`, t, { method: "PATCH", body: JSON.stringify({}) }),
  ownerPayouts: (t: string) => req("/payouts/owner", t),
  publishAnnouncement: (t: string, body: object) => req("/admin/announcements", t, { method: "POST", body: JSON.stringify(body) }),
  adminAnnouncements: (t: string) => req("/admin/announcements", t),
  deleteAnnouncement: (t: string, id: string) => req(`/admin/announcements/${id}`, t, { method: "DELETE" }),
  listAnnouncements: (audience = "ALL") => req(`/admin/announcements/feed?audience=${audience}`, null),
  adminIssues: (t: string) => req("/admin/issues", t),
  adminAudit: (t: string) => req("/admin/audit", t),
  accessFeeMine: (t: string) => req("/access-fee/mine", t),
  initiateAccessFee: (t: string, body: object) => req("/access-fee/initiate", t, { method: "POST", body: JSON.stringify(body) }),
  accessFeeStatus: (t: string, reference: string) => req(`/access-fee/${reference}/status`, t),
  adminHostels: (t: string) => req("/admin/hostels", t),
  suspendHostel: (t: string, hostelId: string, suspended: boolean) =>
    req(`/admin/hostels/${hostelId}/suspend`, t, { method: "PATCH", body: JSON.stringify({ suspended }) }),
  listSchools: () => req("/schools", null),
  adminSchools: (t: string) => req("/admin/schools", t),
  createSchool: (t: string, body: object) => req("/admin/schools", t, { method: "POST", body: JSON.stringify(body) }),
  updateSchool: (t: string, id: string, body: object) => req(`/admin/schools/${id}`, t, { method: "PATCH", body: JSON.stringify(body) }),
  deleteSchool: (t: string, id: string) => req(`/admin/schools/${id}`, t, { method: "DELETE" }),
};
