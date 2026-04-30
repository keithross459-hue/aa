import { useEffect, useState } from "react";
import api from "../api";
import { Copy, Trophy, Users as UsersIcon, DollarSign, TrendingUp, Share2 } from "lucide-react";

export default function Referrals() {
  const [data, setData] = useState(null);
  const [board, setBoard] = useState([]);
  const [copied, setCopied] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [me, lb] = await Promise.all([api.get("/referrals/me"), api.get("/referrals/leaderboard")]);
      setData(me.data);
      setBoard(lb.data.leaderboard || []);
    })();
  }, []);

  const copy = async () => {
    if (!data?.share_url) return;
    await navigator.clipboard.writeText(data.share_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOn = (network) => {
    if (!data?.share_url) return;
    const url = encodeURIComponent(data.share_url);
    const text = encodeURIComponent("I'm shipping digital products + viral ad creatives in 90s flat with FiiLTHY.AI. Come hustle.");
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      tiktok: `https://www.tiktok.com/`,
      instagram: `https://www.instagram.com/`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };
    window.open(shareUrls[network] || data.share_url, "_blank");
  };

  const requestPayout = async () => {
    setPayoutMsg("");
    const r = await api.post("/referrals/payouts/request");
    setPayoutMsg(r.data.ok ? `Payout requested for $${r.data.payout.amount}.` : (r.data.error || "Payout request blocked."));
    const me = await api.get("/referrals/me");
    setData(me.data);
  };

  if (!data) return <div className="p-12 font-mono text-zinc-400">Loading…</div>;

  const tiles = [
    { icon: <UsersIcon />, label: "Signups", value: data.signups, color: "#FFD600" },
    { icon: <TrendingUp />, label: "Conversions", value: data.converted, color: "#FFD600" },
    { icon: <DollarSign />, label: "Total earned", value: `$${data.total_earned}`, color: "#FF3333" },
    { icon: <DollarSign />, label: "Pending payout", value: `$${data.pending_balance}`, color: "#FF3333" },
  ];

  return (
    <div className="p-8 lg:p-12" data-testid="referrals-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Viral loop</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-10">Referral command</h1>

      <div className="border border-zinc-800 bg-zinc-950 p-6 lg:p-8 mb-10" data-testid="referral-share-card">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">▮ Your link</div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={data.share_url}
            readOnly
            onClick={(e) => e.target.select()}
            className="flex-1 min-w-[260px] bg-transparent border border-zinc-800 px-4 py-3 text-[#FFD600] font-mono text-sm focus:border-[#FFD600] focus:outline-none"
            data-testid="referral-input"
          />
          <button
            onClick={copy}
            className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-5 py-3 btn-hard flex items-center gap-2"
            data-testid="copy-referral-btn"
          >
            <Copy className="w-4 h-4" /> {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          {["twitter", "instagram", "tiktok", "linkedin"].map((n) => (
            <button
              key={n}
              onClick={() => shareOn(n)}
              className="border border-zinc-700 text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:bg-white hover:text-black transition-colors flex items-center gap-2"
              data-testid={`share-${n}-btn`}
            >
              <Share2 className="w-3 h-3" /> {n}
            </button>
          ))}
        </div>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Earn 20-30% commission when your referrals upgrade.
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800 mb-10">
        {tiles.map((t, i) => (
          <div key={i} className="bg-zinc-950 p-6" data-testid={`ref-stat-${t.label.toLowerCase().replace(/ /g, "-")}`}>
            <div style={{ color: t.color }} className="mb-4">{t.icon}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">{t.label}</div>
            <div className="font-heading text-4xl">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="border border-zinc-800 bg-zinc-950 p-6 mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Payout automation</div>
            <div className="font-heading text-3xl uppercase">${data.ledger?.available ?? 0} available</div>
            <div className="text-zinc-400 text-sm mt-1">
              Threshold ${data.ledger?.threshold_usd ?? 50} - Fraud risk {data.ledger?.fraud?.risk || "low"}
            </div>
          </div>
          <button
            onClick={requestPayout}
            disabled={!data.ledger?.can_request}
            className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-5 py-3 btn-hard disabled:opacity-40"
            data-testid="request-payout-btn"
          >
            Request payout
          </button>
        </div>
        {payoutMsg && <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">{payoutMsg}</div>}
        {data.ledger?.fraud?.signals?.length > 0 && (
          <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#FF3333]">
            Signals: {data.ledger.fraud.signals.join(", ")}
          </div>
        )}
      </div>

      <div className="border border-zinc-800 bg-zinc-950 mb-10">
        <div className="px-6 py-4 border-b border-zinc-800 font-mono text-xs uppercase tracking-widest flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#FFD600]" /> Leaderboard — top hustlers
        </div>
        {board.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">Leaderboard unlocks when your friends start shipping.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {board.map((r, i) => (
              <div key={r.user_id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-heading text-3xl text-[#FFD600] w-10">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-heading text-2xl uppercase">{r.name}</span>
                </div>
                <div className="font-mono text-sm text-zinc-300">
                  ${r.total_commission} <span className="text-zinc-500">/ {r.sales} sales</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(data.commissions.length > 0 || data.ledger?.payouts?.length > 0) && (
        <div className="border border-zinc-800 bg-zinc-950">
          <div className="px-6 py-4 border-b border-zinc-800 font-mono text-xs uppercase tracking-widest">▮ Recent commissions</div>
          <div className="divide-y divide-zinc-800">
            {(data.ledger?.payouts || []).map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-heading text-lg uppercase">Payout - {p.status}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{p.created_at?.slice(0, 10)}</div>
                </div>
                <div className="font-heading text-2xl text-[#FF3333]">${p.amount}</div>
              </div>
            ))}
            {data.commissions.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-heading text-lg uppercase">{c.plan} — ${c.amount_paid}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{c.created_at?.slice(0, 10)}</div>
                </div>
                <div className="font-heading text-2xl text-[#FFD600]">+${c.commission_earned}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
