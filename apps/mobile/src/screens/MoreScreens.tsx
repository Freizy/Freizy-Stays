import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Share, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Badge, Card, Chip, Empty, ErrorText, Input, PrimaryButton, Screen, Title, ghs } from "../components/ui";
import { api } from "../services/api";
import { saveReceiptPdf } from "../services/receipt";
import { useSession } from "../store/session";

function useAuthedFetch<T>(fn: (token: string) => Promise<T>) {
  const token = useSession((s) => s.token);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    if (!token) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      setData(await fnRef.current(token));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, loading, refresh, token };
}

function shareReceipt(p: any) {
  Share.share({
    message:
      `FREIZY STAYS — Payment Receipt\n` +
      `Hostel: ${p.booking?.hostel?.name ?? ""}\n` +
      `Amount: ${ghs(p.amount ?? 0)} (${String(p.provider).replace("_", " ")})\n` +
      `Reference: ${p.reference}\nStatus: ${p.status}\n` +
      `Your money is safe with Freizy.`,
  }).catch(() => undefined);
}

function ScoreStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => onChange(Math.max(1, value - 1))} style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "800" }}>−</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: "800", fontSize: 16 }}>{value}/5</Text>
        <TouchableOpacity onPress={() => onChange(Math.min(5, value + 1))} style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: "800" }}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function DashboardScreen() {
  const token = useSession((s) => s.token);
  const bookings = useAuthedFetch<any[]>(async (t) => (await api.myBookings(t)) as any[]);
  const payments = useAuthedFetch<any[]>(async (t) => (await api.myPayments(t)) as any[]);
  const reports = useAuthedFetch<any[]>(async (t) => (await api.myIssues(t)) as any[]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  // rating form state
  const [ratingFor, setRatingFor] = useState<string | null>(null);
  const [water, setWater] = useState(4);
  const [light, setLight] = useState(4);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState<string[]>([]);
  const [ratingBusy, setRatingBusy] = useState(false);

  // report form state
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reportMsg, setReportMsg] = useState("");
  const [reportSos, setReportSos] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const confirmMoveIn = async (id: string) => {
    if (!token) return;
    setConfirming(id);
    try {
      await api.confirmMoveIn(token, id);
      bookings.refresh();
    } catch {
      /* surfaced on next render via stale data */
    } finally {
      setConfirming(null);
    }
  };

  const submitRating = async (bookingId: string) => {
    if (!token) return;
    setRatingBusy(true);
    try {
      await api.createRating(token, { bookingId, waterScore: water, lightScore: light, comment: comment.trim() || undefined });
      setRated((r) => [...r, bookingId]);
      setRatingFor(null);
      setComment("");
    } catch {
      /* keep form open */
    } finally {
      setRatingBusy(false);
    }
  };

  const submitReport = async (b: any) => {
    if (!token || reportMsg.trim().length < 3) return;
    setReportBusy(true);
    try {
      await api.createIssue(token, {
        message: reportMsg.trim(),
        kind: reportSos ? "SOS" : "REPORT",
        hostelId: b.hostelId ?? b.hostel?.id,
        bookingId: b.id,
      });
      setReportSent(true);
      setReportFor(null);
      setReportMsg("");
      setReportSos(false);
      reports.refresh();
    } finally {
      setReportBusy(false);
    }
  };

  const savePdf = async (p: any) => {
    setPdfErr(null);
    setPdfBusy(p.id);
    try {
      await saveReceiptPdf(p);
    } catch (e) {
      setPdfErr(e instanceof Error ? e.message : "Could not make PDF");
    } finally {
      setPdfBusy(null);
    }
  };

  const whatsapp = (bookingId: string) =>
    Linking.openURL(
      `https://wa.me/?text=${encodeURIComponent(`Hello, I'm a Freizy Stays tenant (booking ${bookingId.slice(0, 8)}). I'd like to ask about my move-in.`)}`
    ).catch(() => undefined);

  if (!token) {
    return (
      <Screen>
        <Title>Tenant Dashboard</Title>
        <Empty>Log in to see bookings, payments and receipts.</Empty>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={[{ key: "body" }]}
        keyExtractor={(i) => i.key}
        refreshing={bookings.loading || payments.loading}
        onRefresh={() => {
          bookings.refresh();
          payments.refresh();
          reports.refresh();
        }}
        renderItem={() => (
          <View>
            <Title>My bookings</Title>
            {(bookings.data ?? []).length === 0 && !bookings.loading && <Empty>No bookings yet — find a room on Home.</Empty>}
            {(bookings.data ?? []).map((b) => (
              <Card key={b.id} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "800", fontSize: 16, flex: 1 }}>{b.hostel?.name ?? b.hostelId}</Text>
                  <Badge tone={b.status === "moved_in" ? "verified" : b.status === "cancelled" ? "danger" : "pending"}>{b.status}</Badge>
                </View>
                <Text style={{ marginTop: 4 }}>
                  {ghs(b.paidAmount ?? 0)} / {ghs(b.total ?? 0)} · {b.paymentType === "installment" ? "MoMo 4x" : "Full"} · Escrow: {b.escrowStatus}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {b.status === "paid" && (
                    <TouchableOpacity
                      onPress={() => confirmMoveIn(b.id)}
                      disabled={confirming === b.id}
                      style={{ backgroundColor: "#16A34A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700" }}>{confirming === b.id ? "…" : "✓ Confirm move-in"}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => whatsapp(b.id)} style={{ backgroundColor: "#F5F5F5", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
                    <Text>💬 Owner</Text>
                  </TouchableOpacity>
                  {(b.status === "paid" || b.status === "moved_in") && !rated.includes(b.id) && (
                    <TouchableOpacity onPress={() => setRatingFor(ratingFor === b.id ? null : b.id)} style={{ backgroundColor: "#F5F5F5", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
                      <Text>⭐ Rate stay</Text>
                    </TouchableOpacity>
                  )}
                  {(b.status === "paid" || b.status === "moved_in") && (
                    <TouchableOpacity onPress={() => setReportFor(reportFor === b.id ? null : b.id)} style={{ backgroundColor: "#F5F5F5", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
                      <Text>🆘 Report</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {rated.includes(b.id) && (
                  <Text style={{ color: "#16A34A", fontWeight: "700", marginTop: 8 }}>✓ Thanks — rating saved</Text>
                )}
                {ratingFor === b.id && (
                  <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: "#EDEDED", paddingTop: 8 }}>
                    <ScoreStepper label="💧 Water" value={water} onChange={setWater} />
                    <ScoreStepper label="⚡ Light" value={light} onChange={setLight} />
                    <View style={{ marginTop: 8 }}>
                      <Input value={comment} onChangeText={setComment} placeholder="Comment (optional)" />
                    </View>
                    <View style={{ marginTop: 8 }}>
                      <PrimaryButton title="Submit rating" onPress={() => submitRating(b.id)} loading={ratingBusy} />
                    </View>
                  </View>
                )}
                {reportFor === b.id && (
                  <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: "#EDEDED", paddingTop: 8 }}>
                    <View style={{ flexDirection: "row" }}>
                      <Chip label="🆘 SOS (urgent)" on={reportSos} onPress={() => setReportSos(true)} />
                      <Chip label="🔧 Report issue" on={!reportSos} onPress={() => setReportSos(false)} />
                    </View>
                    <Input value={reportMsg} onChangeText={setReportMsg} placeholder={reportSos ? "What's the emergency?" : "e.g. Tap in room 4 is leaking"} multiline />
                    <View style={{ marginTop: 8 }}>
                      <PrimaryButton title={reportSos ? "Send SOS" : "Send report"} onPress={() => submitReport(b)} loading={reportBusy} />
                    </View>
                  </View>
                )}
              </Card>
            ))}

            <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 20 }}>Payments & receipts</Text>
            {(payments.data ?? []).length === 0 && !payments.loading && <Empty>No payments yet.</Empty>}
            {(payments.data ?? []).map((p) => (
              <Card key={p.id} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "800" }}>
                    {ghs(p.amount ?? 0)} · {String(p.provider).replace("_", " ")}
                  </Text>
                  <Badge tone={p.status === "success" ? "verified" : p.status === "failed" ? "danger" : "pending"}>{p.status}</Badge>
                </View>
                <Text style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                  {p.reference} · {p.booking?.hostel?.name ?? ""}
                </Text>
                <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => shareReceipt(p)}>
                    <Text style={{ color: "#E30613", fontWeight: "700" }}>⤴ Share receipt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => savePdf(p)} disabled={pdfBusy === p.id}>
                    <Text style={{ color: "#E30613", fontWeight: "700" }}>{pdfBusy === p.id ? "Making PDF…" : "⤵ Save PDF"}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
            {pdfErr && <ErrorText message={pdfErr} />}

            <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 20 }}>My reports</Text>
            {(reports.data ?? []).length === 0 && !reports.loading && <Empty>No reports sent.</Empty>}
            {(reports.data ?? []).map((r: any) => (
              <Card key={r.id} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <Badge tone={r.kind === "SOS" ? "danger" : "muted"}>{r.kind}</Badge>
                  <Badge tone={r.status === "resolved" ? "verified" : "pending"}>{r.status}</Badge>
                </View>
                <Text style={{ marginTop: 6 }}>{r.message}</Text>
                <Text style={{ color: "#666", fontSize: 12 }}>{r.hostel?.name ?? ""}</Text>
              </Card>
            ))}
            {reportSent && <Text style={{ color: "#16A34A", fontWeight: "700", marginTop: 8 }}>✓ Report sent — the owner has been notified in-app.</Text>}

            {(bookings.loading || payments.loading) && <ActivityIndicator style={{ marginTop: 16 }} />}
            <View style={{ height: 16 }} />
          </View>
        )}
      />
    </Screen>
  );
}

interface Wallet {
  held: number;
  released: number;
  pendingCount: number;
  fees: number;
}

export function OwnerScreen() {
  const token = useSession((s) => s.token);
  const navigation = useNavigation<any>();
  const [listings, setListings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [wallet, setWallet] = useState<Wallet>({ held: 0, released: 0, pendingCount: 0, fees: 0 });
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [l, r, iss, pay] = await Promise.all([
        api.ownerHostels(token) as Promise<any[]>,
        api.ownerBookings(token) as Promise<{ bookings: any[]; wallet: Wallet }>,
        api.ownerIssues(token) as Promise<any[]>,
        api.ownerPayouts(token) as Promise<any[]>,
      ]);
      setListings(l ?? []);
      setRequests(r.bookings ?? []);
      setWallet(Object.assign({ held: 0, released: 0, pendingCount: 0, fees: 0 }, r.wallet ?? {}));
      setPayouts(pay ?? []);
      setIssues((iss ?? []).sort((a, b) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1)));
    } catch {
      /* keep stale data, offline */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const act = async (id: string, kind: "approve" | "reject" | "resolve") => {
    if (!token) return;
    setActing(`${kind}:${id}`);
    try {
      if (kind === "approve") await api.approveBooking(token, id);
      else if (kind === "reject") await api.rejectBooking(token, id);
      else await api.resolveIssue(token, id);
      refresh();
    } finally {
      setActing(null);
    }
  };

  if (!token) {
    return (
      <Screen>
        <Title>Owner</Title>
        <Empty>Log in as an owner to see listings.</Empty>
      </Screen>
    );
  }

  const pending = requests.filter((b) => b.status === "pending");
  const openIssues = issues.filter((i) => i.status === "open");

  return (
    <Screen>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={[{ key: "body" }]}
        keyExtractor={(i) => i.key}
        refreshing={loading}
        onRefresh={refresh}
        renderItem={() => (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Title>Owner</Title>
              <TouchableOpacity onPress={() => navigation.navigate("AddHostel")} style={{ backgroundColor: "#E30613", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>＋ Add hostel</Text>
              </TouchableOpacity>
            </View>

            <Card style={{ marginTop: 12, backgroundColor: "#0A0A0A", borderColor: "#0A0A0A" }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Wallet</Text>
              <Text style={{ color: "#fff", marginTop: 4, fontSize: 16 }}>Available: {ghs(wallet.released)}</Text>
              <Text style={{ color: "#aaa", fontSize: 12 }}>In Freizy escrow: {ghs(wallet.held)} · {wallet.pendingCount} pending · Fees: {ghs(wallet.fees)}</Text>
            </Card>

            {payouts.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: "800", fontSize: 15 }}>Payouts</Text>
                {payouts.map((p: any) => (
                  <Card key={p.id} style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontWeight: "800" }}>{ghs(p.amount ?? 0)}</Text>
                      <Badge tone={p.status === "paid" ? "verified" : "pending"}>{p.status}</Badge>
                    </View>
                    <Text style={{ color: "#666", fontSize: 12 }}>{p.booking?.hostel?.name ?? ""}{p.reference ? ` · ref ${p.reference}` : ""}</Text>
                  </Card>
                ))}
              </View>
            )}

            <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Reports & SOS ({openIssues.length} open)</Text>
            {openIssues.length === 0 && !loading && <Empty>No open reports. 🎉</Empty>}
            {openIssues.map((i) => (
              <Card key={i.id} style={{ marginTop: 10, borderColor: i.kind === "SOS" ? "#E30613" : "#EDEDED" }}>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <Badge tone={i.kind === "SOS" ? "danger" : "muted"}>{i.kind}</Badge>
                  <Text style={{ fontWeight: "800", flex: 1 }}>{i.hostel?.name ?? "General"}</Text>
                </View>
                <Text style={{ marginTop: 6 }}>{i.message}</Text>
                <Text style={{ color: "#666", fontSize: 12 }}>{i.student?.phone ?? i.student?.email ?? ""}</Text>
                <TouchableOpacity
                  onPress={() => act(i.id, "resolve")}
                  disabled={acting === `resolve:${i.id}`}
                  style={{ backgroundColor: "#16A34A", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8, alignSelf: "flex-start" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>{acting === `resolve:${i.id}` ? "…" : "Mark resolved"}</Text>
                </TouchableOpacity>
              </Card>
            ))}

            <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Requests ({pending.length})</Text>
            {pending.length === 0 && !loading && <Empty>No pending requests.</Empty>}
            {pending.map((b) => (
              <Card key={b.id} style={{ marginTop: 10 }}>
                <Text style={{ fontWeight: "800" }}>{b.hostel?.name ?? b.hostelId}</Text>
                <Text style={{ color: "#666", fontSize: 12 }}>{b.student?.phone ?? b.student?.email ?? "Student"} · {b.student?.school ?? ""}</Text>
                <Text style={{ marginTop: 4 }}>
                  {ghs(b.paidAmount ?? 0)} / {ghs(b.total ?? 0)} · {b.paymentType === "installment" ? "MoMo 4x" : "Full"}
                </Text>
                <View style={{ marginTop: 6 }}>
                  <Badge tone={b.ownerApproved ? "verified" : "pending"}>{b.ownerApproved ? "✓ Approved" : "Awaiting approval"}</Badge>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  {!b.ownerApproved && (
                    <TouchableOpacity
                      onPress={() => act(b.id, "approve")}
                      disabled={acting === `approve:${b.id}`}
                      style={{ backgroundColor: "#16A34A", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700" }}>{acting === `approve:${b.id}` ? "…" : "Approve"}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => act(b.id, "reject")}
                    disabled={acting === `reject:${b.id}`}
                    style={{ backgroundColor: "#F5F5F5", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}
                  >
                    <Text>{acting === `reject:${b.id}` ? "…" : "Reject"}</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}

            <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Listings ({listings.length})</Text>
            {listings.map((item) => (
              <Card key={item.id} style={{ marginTop: 10 }}>
                <Text style={{ fontWeight: "800" }}>{item.name}</Text>
                <Text style={{ color: "#666", fontSize: 12 }}>{item.location}</Text>
                <Text style={{ marginTop: 2 }}>{ghs(item.pricePerSemester ?? 0)} / semester</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  {item.suspended && <Badge tone="danger">⛔ Suspended</Badge>}
                  <Badge tone={item.isVerified ? "verified" : "pending"}>{item.isVerified ? "✓ Verified" : "⏳ Pending"}</Badge>
                  <Badge tone="muted">{item.momoAllowed ? "MoMo OK" : "Full only"}</Badge>
                </View>
              </Card>
            ))}
            {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
            <View style={{ height: 16 }} />
          </View>
        )}
      />
    </Screen>
  );
}
