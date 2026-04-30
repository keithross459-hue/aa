import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Shield, Users, DollarSign, TrendingUp, Megaphone, Flag, Search, Ban, Check, Bell } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("overview");
  const [broadcast, setBroadcast] = useState({ subject: "", heading: "", body_html: "", cta_text: "", cta_url: "", plan_filter: "", test_to: "" });
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [flags, setFlags] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", body: "", active: true });

  const loadOverview = async () => setOverview((await api.get("/admin/overview")).data);
  const loadUsers = async (term = "") => setUsers((await api.get(`/admin/users${term ? `?q=${encodeURIComponent(term)}` : ""}`)).data.users);
  const loadFlags = async () => setFlags((await api.get("/admin/feature-flags")).data.flags);
  const loadAnnouncements = async () => setAnnouncements((await api.get("/admin/announcements")).data.announcements);
  const loadPayouts = async () => setPayouts((await api.get("/admin/payouts")).data.payouts || []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    loadOverview();
    loadUsers();
    loadFlags();
    loadAnnouncements();
    loadPayouts();
  }, [user]);

  const openUser = async (uid) => {
    setSelected(uid);
    setDetail((await api.get(`/admin/users/${uid}`)).data);
  };

  const banUser = async (uid) => {
    await api.post(`/admin/users/${uid}/ban`);
    await openUser(uid);
    await loadUsers(q);
  };
  const unbanUser = async (uid) => {
    await api.post(`/admin/users/${uid}/unban`);
    await openUser(uid);
    await loadUsers(q);
  };

  const sendBroadcast = async (testMode) => {
    const payload = { ...broadcast };
    if (testMode) payload.test_to = broadcast.test_to || user.email;
    else delete payload.test_to;
    const r = await api.post("/admin/broadcast", payload);
    setBroadcastResult(r.data);
  };

  const toggleFlag = async (key, current) => {
    await api.put("/admin/feature-flags", { key, value: !current });
    loadFlags();
  };

  const addAnnouncement = async () => {
    await api.post("/admin/announcements", newAnnouncement);
    setNewAnnouncement({ title: "", body: "", active: true });
    loadAnnouncements();
  };

  const deleteAnnouncement = async (id) => {
    await api.delete(`/admin/announcements/${id}`);
    loadAnnouncements();
  };

  const payoutAction = async (id, action) => {
    await api.post(`/admin/payouts/${id}/${action}`, action === "reject" ? { reason: "Rejected in admin review" } : {});
    loadPayouts();
    loadOverview();
  };

  if (user?.role !== "admin") {
    return (
      <div className="p-12">
        <div className="border border-[#FF3333] bg-[#FF3333]/10 p-8">
          <div className="font-heading text-3xl uppercase text-[#FF3333]">Admin only.</div>
          <div className="text-zinc-400 mt-2">This control room is reserved for the operator.</div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: <TrendingUp className="w-3 h-3" /> },
    { id: "users", label: "Users", icon: <Users className="w-3 h-3" /> },
    { id: "broadcast", label: "Broadcast", icon: <Megaphone className="w-3 h-3" /> },
    { id: "payouts", label: "Payouts", icon: <DollarSign className="w-3 h-3" /> },
    { id: "flags", label: "Feature Flags", icon: <Flag className="w-3 h-3" /> },
    { id: "announcements", label: "Announcements", icon: <Bell className="w-3 h-3" /> },
  ];

  return (
    <div className="p-8 lg:p-12" data-testid="admin-page">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="w-5 h-5 text-[#FFD600]" />
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600]">▮ Super Admin</div>
      </div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-10">Control Room</h1>

      <div className="flex gap-px bg-zinc-800 border border-zinc-800 mb-10 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 font-mono text-xs uppercase tracking-widest flex items-center gap-2 whitespace-nowrap ${
              tab === t.id ? "bg-[#FFD600] text-black" : "bg-zinc-950 text-zinc-400 hover:text-white"
            }`}
            data-testid={`admin-tab-${t.id}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && overview && (
        <div className="space-y-px bg-zinc-800 border border-zinc-800">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800">
            <Tile label="MRR" value={`$${overview.revenue.mrr}`} color="#FFD600" icon={<DollarSign />} />
            <Tile label="ARR" value={`$${overview.revenue.arr}`} color="#FFD600" icon={<DollarSign />} />
            <Tile label="Gross lifetime" value={`$${overview.revenue.gross_lifetime}`} color="#FF3333" icon={<TrendingUp />} />
            <Tile label="Referral $" value={`$${overview.referrals.total_commissions}`} color="#FF3333" icon={<TrendingUp />} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800">
            <Tile label="Total users" value={overview.users.total} color="#FFD600" icon={<Users />} />
            <Tile label="Paid users" value={overview.users.paid} color="#FFD600" icon={<Users />} />
            <Tile label="Last 7d signups" value={overview.users.last_7d} color="#FF3333" icon={<Users />} />
            <Tile label="Cancelled 30d" value={overview.users.cancelled_30d} color="#FF3333" icon={<Ban />} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800">
            <Tile label="Products" value={overview.products} color="#FFD600" icon={<TrendingUp />} />
            <Tile label="Campaigns" value={overview.campaigns} color="#FFD600" icon={<Megaphone />} />
            <Tile label="Listings" value={overview.listings} color="#FF3333" icon={<TrendingUp />} />
            <Tile label="Referral signups" value={overview.referrals.total_attributions} color="#FF3333" icon={<Users />} />
          </div>
        </div>
      )}

      {tab === "users" && (
        <div>
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadUsers(q)}
                placeholder="search email / name / id"
                className="w-full bg-transparent border border-zinc-800 pl-10 pr-4 py-3 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none"
                data-testid="user-search-input"
              />
            </div>
            <button onClick={() => loadUsers(q)} className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-5 btn-hard">Search</button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800">
            <div className="bg-zinc-950">
              <div className="px-4 py-3 border-b border-zinc-800 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                {users.length} users
              </div>
              <div className="divide-y divide-zinc-800 max-h-[520px] overflow-y-auto">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openUser(u.id)}
                    className={`w-full text-left p-4 hover:bg-zinc-900 ${selected === u.id ? "bg-zinc-900" : ""}`}
                    data-testid={`admin-user-row-${u.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-heading text-lg uppercase truncate">{u.name}</div>
                        <div className="font-mono text-[10px] text-zinc-500 truncate">{u.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.banned && <span className="font-mono text-[9px] uppercase bg-[#FF3333] text-white px-2 py-0.5">Banned</span>}
                        <span className="font-mono text-[9px] uppercase bg-zinc-800 text-zinc-300 px-2 py-0.5">{u.plan}</span>
                        {u.role === "admin" && <span className="font-mono text-[9px] uppercase bg-[#FFD600] text-black px-2 py-0.5">Admin</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-zinc-950 p-6 max-h-[560px] overflow-y-auto">
              {!detail ? (
                <div className="text-center text-zinc-500 font-mono text-xs uppercase tracking-widest py-20">Select a user →</div>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                    <div>
                      <div className="font-heading text-2xl uppercase">{detail.user.name}</div>
                      <div className="font-mono text-xs text-zinc-500">{detail.user.email}</div>
                    </div>
                    {detail.user.banned ? (
                      <button onClick={() => unbanUser(detail.user.id)} className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard flex items-center gap-2">
                        <Check className="w-3 h-3" /> Unban
                      </button>
                    ) : (
                      <button onClick={() => banUser(detail.user.id)} className="bg-[#FF3333] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard btn-hard-red flex items-center gap-2">
                        <Ban className="w-3 h-3" /> Ban
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                    <Pill label="Plan" value={detail.user.plan} />
                    <Pill label="Role" value={detail.user.role || "user"} />
                    <Pill label="Status" value={detail.user.subscription_status || "-"} />
                    <Pill label="Products" value={detail.stats.products} />
                    <Pill label="Campaigns" value={detail.stats.campaigns} />
                    <Pill label="Referrals" value={detail.stats.referrals} />
                  </div>
                  {detail.transactions.length > 0 && (
                    <>
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-4 mb-2">Recent transactions</div>
                      <div className="divide-y divide-zinc-800 border border-zinc-800">
                        {detail.transactions.slice(0, 8).map((t) => (
                          <div key={t.id} className="p-3 flex items-center justify-between">
                            <div className="font-mono text-xs">
                              <div className="text-zinc-200">${t.amount} <span className="text-zinc-500">{t.plan}</span></div>
                              <div className="text-zinc-500 text-[10px]">{(t.created_at || "").slice(0, 10)}</div>
                            </div>
                            <span className={`font-mono text-[9px] uppercase px-2 py-0.5 ${t.payment_status === "paid" ? "bg-[#FFD600] text-black" : "bg-zinc-800 text-zinc-400"}`}>
                              {t.payment_status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "broadcast" && (
        <div className="border border-zinc-800 bg-zinc-950 p-6 max-w-3xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">▮ Send to users</div>
          <label className="block mb-3">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Subject</span>
            <input value={broadcast.subject} onChange={(e) => setBroadcast({ ...broadcast, subject: e.target.value })} className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none" data-testid="broadcast-subject" />
          </label>
          <label className="block mb-3">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Heading (in email)</span>
            <input value={broadcast.heading} onChange={(e) => setBroadcast({ ...broadcast, heading: e.target.value })} className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none" />
          </label>
          <label className="block mb-3">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Body (HTML allowed)</span>
            <textarea value={broadcast.body_html} onChange={(e) => setBroadcast({ ...broadcast, body_html: e.target.value })} rows={6} className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none" data-testid="broadcast-body" />
          </label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-1">CTA text</span>
              <input value={broadcast.cta_text} onChange={(e) => setBroadcast({ ...broadcast, cta_text: e.target.value })} className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none" />
            </label>
            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-1">CTA URL</span>
              <input value={broadcast.cta_url} onChange={(e) => setBroadcast({ ...broadcast, cta_url: e.target.value })} className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Plan filter (optional)</span>
              <select value={broadcast.plan_filter} onChange={(e) => setBroadcast({ ...broadcast, plan_filter: e.target.value })} className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none">
                <option value="">All users</option>
                <option value="free">Free only</option>
                <option value="starter">Starter only</option>
                <option value="pro">Pro only</option>
                <option value="enterprise">Enterprise only</option>
              </select>
            </label>
            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Test recipient</span>
              <input value={broadcast.test_to} onChange={(e) => setBroadcast({ ...broadcast, test_to: e.target.value })} placeholder="you@filthy.ai" className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => sendBroadcast(true)} className="border border-zinc-700 text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:bg-white hover:text-black">Send test</button>
            <button onClick={() => sendBroadcast(false)} className="bg-[#FF3333] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard btn-hard-red" data-testid="broadcast-send-btn">Send to all</button>
          </div>
          {broadcastResult && (
            <div className="mt-4 bg-zinc-900 border border-zinc-800 p-3 font-mono text-xs text-zinc-300" data-testid="broadcast-result">
              {broadcastResult.mode === "test" ? `Test: ${broadcastResult.result?.ok ? "✓" : "✗"}` : `Sent ${broadcastResult.sent}/${broadcastResult.total_recipients} (${broadcastResult.failed} failed)`}
            </div>
          )}
        </div>
      )}

      {tab === "payouts" && (
        <div className="border border-zinc-800 bg-zinc-950 max-w-5xl">
          <div className="px-6 py-4 border-b border-zinc-800 font-mono text-xs uppercase tracking-widest">Referral payout approvals</div>
          {payouts.length === 0 ? (
            <div className="p-6 font-mono text-xs text-zinc-500 uppercase tracking-widest">No payout requests yet.</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {payouts.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-heading text-2xl uppercase">${p.amount} - {p.status}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                      {p.email || p.referrer_user_id} - risk {p.fraud?.risk || "low"}
                    </div>
                    {p.fraud?.signals?.length > 0 && <div className="text-[#FF3333] font-mono text-[10px] uppercase tracking-widest mt-1">{p.fraud.signals.join(", ")}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => payoutAction(p.id, "approve")} disabled={p.status !== "requested"} className="bg-[#FFD600] text-black font-mono text-[10px] uppercase tracking-widest px-3 py-2 disabled:opacity-40">Approve</button>
                    <button onClick={() => payoutAction(p.id, "paid")} disabled={p.status !== "approved"} className="border border-zinc-700 text-white font-mono text-[10px] uppercase tracking-widest px-3 py-2 disabled:opacity-40">Paid</button>
                    <button onClick={() => payoutAction(p.id, "reject")} disabled={p.status === "paid"} className="border border-[#FF3333] text-[#FF3333] font-mono text-[10px] uppercase tracking-widest px-3 py-2 disabled:opacity-40">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "flags" && (
        <div className="border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 max-w-3xl">
          {flags.length === 0 ? (
            <div className="p-6 font-mono text-xs text-zinc-500 uppercase tracking-widest">No flags set yet.</div>
          ) : flags.map((f) => (
            <div key={f.key} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm text-white">{f.key}</div>
                <div className="text-xs text-zinc-500">{f.description}</div>
              </div>
              <button
                onClick={() => toggleFlag(f.key, f.value)}
                className={`font-mono text-xs uppercase tracking-widest px-4 py-2 ${f.value ? "bg-[#FFD600] text-black" : "bg-zinc-800 text-zinc-400"}`}
                data-testid={`flag-${f.key}`}
              >
                {f.value ? "ON" : "OFF"}
              </button>
            </div>
          ))}
          <div className="p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Add new flag</div>
            <AddFlagForm onAdded={loadFlags} />
          </div>
        </div>
      )}

      {tab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 max-w-5xl">
          <div className="bg-zinc-950 p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">▮ New announcement</div>
            <input value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} placeholder="Title" className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm mb-2 focus:border-[#FFD600] focus:outline-none" />
            <textarea value={newAnnouncement.body} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })} placeholder="Body" rows={4} className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-sm mb-3 focus:border-[#FFD600] focus:outline-none" />
            <button onClick={addAnnouncement} disabled={!newAnnouncement.title} className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard disabled:opacity-50">Post</button>
          </div>
          <div className="bg-zinc-950">
            <div className="px-6 py-4 border-b border-zinc-800 font-mono text-xs uppercase tracking-widest">Active & past</div>
            <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto">
              {announcements.length === 0 ? (
                <div className="p-6 font-mono text-xs text-zinc-500">No announcements yet.</div>
              ) : announcements.map((a) => (
                <div key={a.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-heading text-lg uppercase">{a.title}</div>
                    <div className="text-zinc-400 text-sm">{a.body}</div>
                    <div className="font-mono text-[10px] text-zinc-600 mt-1">{(a.created_at || "").slice(0, 10)}</div>
                  </div>
                  <button onClick={() => deleteAnnouncement(a.id)} className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-[#FF3333]">Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, color, icon }) {
  return (
    <div className="bg-zinc-950 p-6">
      <div style={{ color }} className="mb-3">{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">{label}</div>
      <div className="font-heading text-4xl">{value}</div>
    </div>
  );
}

function Pill({ label, value }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-heading text-base uppercase truncate">{value}</div>
    </div>
  );
}

function AddFlagForm({ onAdded }) {
  const [key, setKey] = useState("");
  const [desc, setDesc] = useState("");
  const submit = async () => {
    if (!key) return;
    await api.put("/admin/feature-flags", { key, value: false, description: desc });
    setKey(""); setDesc("");
    onAdded();
  };
  return (
    <div className="flex gap-2 flex-wrap">
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="flag_key" className="flex-1 min-w-[200px] bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-xs focus:border-[#FFD600] focus:outline-none" />
      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="description" className="flex-1 min-w-[200px] bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-xs focus:border-[#FFD600] focus:outline-none" />
      <button onClick={submit} className="bg-[#FFD600] text-black font-mono text-[10px] uppercase tracking-widest px-4">Add</button>
    </div>
  );
}
