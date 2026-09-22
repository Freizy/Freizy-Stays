import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Badge, Card, Empty, ErrorText, GhostButton, Input, PrimaryButton, Screen, Title, ghs } from "../components/ui";
import { theme } from "../theme";
import { api } from "../services/api";
import { useSession } from "../store/session";

const CHECKLIST = [
  "Photos verified (5+ real photos)",
  "Video tour reviewed",
  "Location pin confirmed",
  "Price within area norm",
  "Owner contact confirmed",
];

const AUDIENCES = ["ALL", "STUDENT", "OWNER"] as const;

export function AdminScreen() {
  const token = useSession((s) => s.token);
  const [stats, setStats] = useState<any>(null);
  const [hostels, setHostels] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [anns, setAnns] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, string[]>>({});
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annAud, setAnnAud] = useState<string>("ALL");

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const [s, h, b, p, u, i, a, au] = await Promise.allSettled([
      api.adminStats(token),
      api.hostels(token),
      api.adminBookings(token),
      api.adminPayouts(token),
      api.adminUsers(token, userSearch.trim()),
      api.adminIssues(token),
      api.adminAnnouncements(token),
      api.adminAudit(token),
    ]);
    if (s.status === "fulfilled") setStats(s.value);
    if (h.status === "fulfilled") setHostels((h.value as { data: any[] }).data ?? []);
    if (b.status === "fulfilled") setBookings(b.value);
    if (p.status === "fulfilled") setPayouts(p.value);
    if (u.status === "fulfilled") setUsers(u.value);
    if (i.status === "fulfilled") setIssues(i.value);
    if (a.status === "fulfilled") setAnns(a.value);
    if (au.status === "fulfilled") setAudit(au.value);
    if (s.status === "rejected") setError("Some admin data failed to load.");
    setLoading(false);
  }, [token, userSearch]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (!token) return;
    setActing(key);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  const toggleCheck = (hostelId: string, item: string, current: string[]) => {
    const has = current.includes(item);
    setChecks((c) => ({ ...c, [hostelId]: has ? current.filter((x) => x !== item) : [...current, item] }));
  };

  if (!token) {
    return (
      <Screen>
        <Title>Admin</Title>
        <Empty>Log in as an admin.</Empty>
      </Screen>
    );
  }

  const releasable = bookings.filter((b) => b.status === "moved_in" && b.escrowStatus === "held");
  const refundable = bookings.filter((b) => b.paidAmount > 0 && b.escrowStatus === "held" && b.status !== "moved_in" && b.status !== "cancelled");
  const pendingPayouts = payouts.filter((p) => p.status === "pending");

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Title>Admin console</Title>

        {stats && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {[
              [`${stats.bookings?.total ?? 0}`, "Bookings"],
              [`${ghs(stats.money?.gmv ?? 0)}`, "GMV"],
              [`${ghs(stats.money?.held ?? 0)}`, "In escrow"],
              [`${ghs(stats.money?.fees ?? 0)}`, "Fees earned"],
              [`${stats.hostels?.verified ?? 0}/${stats.hostels?.total ?? 0}`, "Verified"],
              [`${stats.issues?.open ?? 0}`, "Open issues"],
              [`${stats.payouts?.pending ?? 0}`, "Payouts due"],
              [`${stats.users?.total ?? 0}`, "Users"],
            ].map(([v, l]) => (
              <Card key={l} style={{ width: "31%", padding: 10 }}>
                <Text style={{ fontWeight: "800", fontSize: 15 }} numberOfLines={1}>{v}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>{l}</Text>
              </Card>
            ))}
          </View>
        )}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Verify hostels</Text>
        {hostels.filter((h) => !h.isVerified).length === 0 && !loading && <Empty>All verified. 🎉</Empty>}
        {[...hostels.filter((h) => !h.isVerified), ...hostels.filter((h) => h.isVerified)].map((h) => {
          const checked = checks[h.id] ?? h.verificationChecklist ?? [];
          const open = expanded === h.id;
          return (
            <Card key={h.id} style={{ marginTop: 10 }}>
              <TouchableOpacity onPress={() => setExpanded(open ? null : h.id)}>
                <Text style={{ fontWeight: "800" }}>{h.name} {open ? "▾" : "▸"}</Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{h.location} · {ghs(h.pricePerSemester ?? 0)}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <Badge tone={h.isVerified ? "verified" : "pending"}>{h.isVerified ? "✓ Verified" : "⏳ Unverified"}</Badge>
                <View style={{ width: 130 }}>
                  {acting === `verify:${h.id}` ? (
                    <ActivityIndicator />
                  ) : h.isVerified ? (
                    <GhostButton title="Unverify" onPress={() => run(`verify:${h.id}`, () => api.verifyHostel(token, h.id, false, []))} />
                  ) : (
                    <PrimaryButton title="Verify ✓" onPress={() => run(`verify:${h.id}`, () => api.verifyHostel(token, h.id, true, checked))} />
                  )}
                </View>
              </View>
              {open && (
                <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: "#EDEDED", paddingTop: 8 }}>
                  {CHECKLIST.map((c) => (
                    <TouchableOpacity key={c} onPress={() => toggleCheck(h.id, c, checked)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
                      <Text style={{ fontSize: 16 }}>{checked.includes(c) ? "☑" : "☐"}</Text>
                      <Text style={{ marginLeft: 8, fontSize: 13 }}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                    {checked.length}/{CHECKLIST.length} checked{h.verifiedAt ? ` · verified ${new Date(h.verifiedAt).toLocaleDateString()}` : ""}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Input value={priceEdits[h.id] ?? String(h.pricePerSemester ?? "")} onChangeText={(v) => setPriceEdits((p) => ({ ...p, [h.id]: v }))} keyboardType="number-pad" placeholder="Price/sem" />
                    </View>
                    <View style={{ width: 110 }}>
                      <GhostButton title="Set price" onPress={() => run(`price:${h.id}`, () => api.adminUpdateHostel(token, h.id, { pricePerSemester: Number(priceEdits[h.id]) }))} />
                    </View>
                    <TouchableOpacity
                      onPress={() => Alert.alert("Delete hostel?", `${h.name} will be removed. Blocked while bookings are active.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => run(`del:${h.id}`, () => api.adminDeleteHostel(token, h.id)) }])}
                      style={{ backgroundColor: "#FDECEC", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                    >
                      <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </Card>
          );
        })}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Release escrow ({releasable.length})</Text>
        {releasable.map((b) => (
          <Card key={b.id} style={{ marginTop: 10 }}>
            <Text style={{ fontWeight: "800" }}>{b.hostel?.name ?? b.hostelId}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{b.student?.phone ?? b.student?.email} · {ghs(b.paidAmount ?? 0)} held</Text>
            <View style={{ marginTop: 8 }}>
              {acting === `release:${b.id}` ? <ActivityIndicator /> : <PrimaryButton title={`Release (5% fee) →`} onPress={() => run(`release:${b.id}`, () => api.releaseEscrow(token, b.id))} />}
            </View>
          </Card>
        ))}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Refunds ({refundable.length})</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>Held + paid, pre-move-in. Pilot: reverse manually via MoMo, then mark.</Text>
        {refundable.slice(0, 10).map((b) => (
          <Card key={b.id} style={{ marginTop: 10 }}>
            <Text style={{ fontWeight: "800" }}>{b.hostel?.name ?? b.hostelId} · {ghs(b.paidAmount ?? 0)}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{b.student?.phone ?? b.student?.email} · {b.status}</Text>
            <View style={{ marginTop: 8 }}>
              {acting === `refund:${b.id}` ? <ActivityIndicator /> : <GhostButton title="Mark refunded" onPress={() => Alert.alert("Mark refunded?", `Confirm GH₵${(b.paidAmount ?? 0).toLocaleString()} was reversed to the student.`, [{ text: "Cancel", style: "cancel" }, { text: "Mark refunded", onPress: () => run(`refund:${b.id}`, () => api.refundBooking(token, b.id)) }])} />}
            </View>
          </Card>
        ))}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Payouts ({pendingPayouts.length} due)</Text>
        {pendingPayouts.length === 0 && !loading && <Empty>Nothing due.</Empty>}
        {pendingPayouts.map((p) => (
          <Card key={p.id} style={{ marginTop: 10 }}>
            <Text style={{ fontWeight: "800" }}>{ghs(p.amount ?? 0)} → {p.owner?.phone ?? p.owner?.email}</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{p.booking?.hostel?.name ?? ""}</Text>
            <View style={{ marginTop: 8 }}>
              {acting === `payout:${p.id}` ? <ActivityIndicator /> : <PrimaryButton title="Mark paid" onPress={() => run(`payout:${p.id}`, () => api.payoutMarkPaid(token, p.id))} />}
            </View>
          </Card>
        ))}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Broadcast</Text>
        <Card style={{ marginTop: 10 }}>
          <Input value={annTitle} onChangeText={setAnnTitle} placeholder="Title e.g. Move-in weekend" />
          <View style={{ marginTop: 8 }}>
            <Input value={annBody} onChangeText={setAnnBody} placeholder="Message…" multiline />
          </View>
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            {AUDIENCES.map((a) => (
              <TouchableOpacity key={a} onPress={() => setAnnAud(a)} style={{ backgroundColor: annAud === a ? theme.colors.black : theme.colors.muted, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}>
                <Text style={{ color: annAud === a ? "#fff" : theme.colors.text, fontWeight: annAud === a ? "700" : "400", fontSize: 12 }}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ marginTop: 10 }}>
            <PrimaryButton title="Publish + push →" onPress={() => run("publish", async () => { await api.publishAnnouncement(token, { title: annTitle.trim(), body: annBody.trim(), audience: annAud }); setAnnTitle(""); setAnnBody(""); })} />
          </View>
        </Card>
        {anns.slice(0, 5).map((a) => (
          <Card key={a.id} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontWeight: "800", flex: 1 }}>{a.title} <Text style={{ fontWeight: "400", color: "#999", fontSize: 11 }}>· {a.audience}</Text></Text>
              <TouchableOpacity onPress={() => run(`delann:${a.id}`, () => api.deleteAnnouncement(token, a.id))}>
                <Text style={{ color: theme.colors.primary }}>Delete</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#555", fontSize: 13, marginTop: 2 }}>{a.body}</Text>
          </Card>
        ))}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Users</Text>
        <View style={{ marginTop: 8 }}>
          <Input value={userSearch} onChangeText={setUserSearch} placeholder="Search email or phone…" onSubmitEditing={refresh} returnKeyType="search" />
        </View>
        {users.slice(0, 20).map((u) => (
          <Card key={u.id} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontWeight: "800", flex: 1 }} numberOfLines={1}>{u.email ?? u.phone ?? u.id.slice(0, 8)}</Text>
              <Badge tone={u.suspended ? "danger" : u.role === "ADMIN" ? "verified" : "muted"}>{u.suspended ? "SUSPENDED" : u.role}</Badge>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {(["STUDENT", "OWNER", "ADMIN"] as const).filter((r) => r !== u.role).map((r) => (
                <TouchableOpacity key={r} onPress={() => Alert.alert("Change role?", `Set ${u.email ?? u.phone} to ${r}?`, [{ text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: () => run(`role:${u.id}`, () => api.setUserRole(token, u.id, r)) }])} style={{ backgroundColor: "#F5F5F5", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
                  <Text style={{ fontSize: 12 }}>→ {r}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => run(`susp:${u.id}`, () => api.setUserSuspended(token, u.id, !u.suspended))} style={{ backgroundColor: u.suspended ? "#16A34A" : "#FDECEC", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
                <Text style={{ fontSize: 12, color: u.suspended ? "#fff" : theme.colors.primary, fontWeight: "700" }}>{u.suspended ? "Unsuspend" : "Suspend"}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Disputes ({issues.filter((i: any) => i.status !== "resolved").length} open)</Text>
        {issues.slice(0, 15).map((i: any) => (
          <Card key={i.id} style={{ marginTop: 8, borderColor: i.status === "escalated" ? theme.colors.primary : "#EDEDED" }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <Badge tone={i.kind === "SOS" ? "danger" : "muted"}>{i.kind}</Badge>
              <Badge tone={i.status === "resolved" ? "verified" : i.status === "escalated" ? "danger" : "pending"}>{i.status}</Badge>
            </View>
            <Text style={{ marginTop: 6 }}>{i.message}</Text>
            <Text style={{ color: "#666", fontSize: 12 }}>{i.hostel?.name ?? "General"} · {i.student?.phone ?? i.student?.email}</Text>
            {i.status !== "resolved" && (
              <View style={{ marginTop: 8 }}>
                <GhostButton title="Mark resolved" onPress={() => run(`ires:${i.id}`, () => api.resolveIssue(token, i.id))} />
              </View>
            )}
          </Card>
        ))}

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 20 }}>Audit trail</Text>
        {(audit as any[]).slice(0, 20).map((a: any) => (
          <Text key={a.id} style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
            {new Date(a.createdAt).toLocaleString()} · {a.action} · {a.entity}{a.entityId ? ` ${String(a.entityId).slice(0, 8)}` : ""}
          </Text>
        ))}

        <ErrorText message={error} />
        {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}
