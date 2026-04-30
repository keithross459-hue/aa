import { Link } from "react-router-dom";
import { useState } from "react";
import { Check, Zap, Loader2 } from "lucide-react";
import api from "../api";
import { useAuth } from "../auth";

const TIERS = [
  { id: "free", name: "Free", price: "$0", limit: "5 generations", border: "border-zinc-800", badge: null, perks: ["5 product generations", "Basic ads", "All 7 stores", "Community support"] },
  { id: "starter", name: "Starter", price: "$29", limit: "50/mo", border: "border-white", badge: null, perks: ["50 generations", "All ad platforms", "All stores", "Email support"] },
  { id: "pro", name: "Pro", price: "$79", limit: "500/mo", border: "border-[#FFD600]", badge: "HUSTLER", perks: ["500 generations", "Priority generation", "All stores + analytics", "Priority support"] },
  { id: "enterprise", name: "Enterprise", price: "$299", limit: "Unlimited", border: "border-[#FF3333]", badge: null, perks: ["Unlimited", "API access", "White-label", "Dedicated success"] },
];

const TEX = "https://images.unsplash.com/photo-1768622943825-2416a5584b65?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxncml0dHklMjBjb25jcmV0ZSUyMHRleHR1cmUlMjBkYXJrfGVufDB8fHx8MTc3NzI2MTg0OHww&ixlib=rb-4.1.0&q=85";

export default function Pricing() {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  const upgrade = async (planId) => {
    setErr("");
    if (!user) {
      window.location.href = "/signup";
      return;
    }
    if (planId === "free") {
      window.location.href = "/app";
      return;
    }
    setBusyId(planId);
    try {
      const r = await api.post("/billing/create-checkout", {
        plan: planId,
        origin_url: window.location.origin,
      });
      window.location.href = r.data.url;
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Checkout failed. Try again.");
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white relative" data-testid="pricing-page">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `url(${TEX})`, backgroundSize: "cover" }} />
      <div className="absolute inset-0 bg-[#09090B]/80" />
      <div className="relative">
        <header className="border-b border-zinc-800">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-[#FFD600]" strokeWidth={2.5} />
              <span className="font-heading text-3xl">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
            </Link>
            <Link to="/app" className="font-mono text-xs uppercase tracking-widest text-zinc-300 hover:text-white">
              ← Back to app
            </Link>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600] mb-4">▮ Pricing</div>
          <h1 className="font-heading text-6xl lg:text-8xl uppercase mb-4 leading-[0.9]">
            Pay <span className="text-[#FF3333]">filthy.</span> Win bigger.
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mb-16">No hidden fees. No platform tax. Cancel anytime.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800">
            {err && (
              <div className="col-span-full bg-[#FF3333]/10 border border-[#FF3333] text-[#FF3333] font-mono text-xs uppercase tracking-widest px-4 py-3" data-testid="pricing-error">
                {String(err)}
              </div>
            )}
            {TIERS.map((t) => (
              <div key={t.id} className={`bg-zinc-950 p-8 border-t-4 ${t.border} relative`} data-testid={`pricing-${t.id}`}>
                {t.badge && (
                  <div className="absolute top-4 right-4 bg-[#FFD600] text-black font-mono text-[10px] uppercase tracking-widest px-2 py-1">
                    {t.badge}
                  </div>
                )}
                <div className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-2">{t.name}</div>
                <div className="font-heading text-6xl mb-1">{t.price}</div>
                <div className="font-mono text-xs text-[#FFD600] uppercase tracking-widest mb-6">{t.limit}</div>
                <ul className="space-y-3 mb-8">
                  {t.perks.map((p, i) => (
                    <li key={i} className="flex gap-2 text-zinc-300 text-sm">
                      <Check className="w-4 h-4 text-[#FFD600] flex-shrink-0 mt-0.5" /> {p}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => upgrade(t.id)}
                  disabled={busyId === t.id}
                  className={`w-full block text-center font-mono text-xs uppercase tracking-widest py-3 btn-hard disabled:opacity-60 ${
                    t.id === "pro"
                      ? "bg-[#FFD600] text-black"
                      : t.id === "enterprise"
                      ? "bg-[#FF3333] text-white btn-hard-red"
                      : "border border-zinc-700 text-white hover:bg-white hover:text-black"
                  }`}
                  data-testid={`pricing-cta-${t.id}`}
                >
                  {busyId === t.id ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2 className="w-3 h-3 animate-spin" /> Redirecting…
                    </span>
                  ) : (
                    <>{t.id === "free" ? "Start free" : "Get started"} →</>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
