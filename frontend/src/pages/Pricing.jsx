import { Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CreditCard, Loader2, ShieldCheck, Zap } from "lucide-react";
import api from "../api";
import { useAuth } from "../auth";

const STARTER_PROMO_CODE = "STARTER50";

const TIERS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    limit: "Preview product concepts",
    border: "border-zinc-800",
    badge: null,
    note: "No card required",
    cta: "Continue free",
    perks: ["Product quality preview", "Partial outline and value bullets", "See sellability score", "Unlock only the products you want"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    limit: "All packages included",
    border: "border-[#FFD600]",
    badge: "START HERE",
    note: "Founder offer: 50% off your first month, then $29/mo. Best if you will build more than three products.",
    cta: "Unlock all - $14.50",
    featured: true,
    perks: ["Full product packages", "Complete store upload bundles", "Cover PNG + promo videos", "Campaigns, publishing, and tracking"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$49.99",
    limit: "Higher-volume product lab",
    border: "border-white",
    badge: null,
    note: "For users already launching often",
    cta: "Upgrade to Pro",
    perks: ["More product quality cycles", "Advanced content variations", "Faster testing", "Real store publishing + analytics"],
  },
  {
    id: "enterprise",
    name: "CEO",
    price: "$299.99",
    limit: "For operators scaling hard",
    border: "border-zinc-800",
    badge: null,
    note: "Start with Starter or Pro unless you already have volume",
    cta: "Choose CEO",
    muted: true,
    perks: ["Usage-based scaling options", "API access", "White-label", "Dedicated success"],
  },
];

const TEX = "https://images.unsplash.com/photo-1768622943825-2416a5584b65?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxncml0dHklMjBjb25jcmV0ZSUyMHRleHR1cmUlMjBkYXJrfGVufDB8fHx8MTc3NzI2MTg0OHww&ixlib=rb-4.1.0&q=85";

export default function Pricing() {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const autoStarted = useRef(false);

  const upgrade = useCallback(async (planId) => {
    setErr("");
    if (!user) {
      window.location.href = `/signup?plan=${planId}`;
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
        coupon_code: planId === "starter" ? STARTER_PROMO_CODE : undefined,
      });
      window.location.href = r.data.url;
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Checkout failed. Try again.");
      setBusyId(null);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const canceledPlan = params.get("checkout_canceled");
    if (["starter", "pro", "enterprise"].includes(canceledPlan)) {
      setNotice(`${canceledPlan} checkout was canceled. You can restart secure checkout when you are ready.`);
    }
    const checkoutPlan = params.get("checkout");
    if (!user || autoStarted.current || !["starter", "pro", "enterprise"].includes(checkoutPlan)) return;
    autoStarted.current = true;
    upgrade(checkoutPlan);
  }, [upgrade, user]);

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
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600] mb-4">Preview free. Pay for complete products.</div>
          <h1 className="font-heading text-6xl lg:text-8xl uppercase mb-4 leading-[0.9]">
            Pay when the product is worth unlocking.
          </h1>
          <p className="text-lg text-zinc-300 max-w-2xl mb-6">
            Free users see a premium preview. Unlock one complete product package for $9, or use Starter when you want every full product, cover, store bundle, promo video, campaign, and launch tool included.
          </p>
          <div className="mb-10 grid max-w-3xl grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
            <TrustItem icon={<ShieldCheck />} label="Secure Stripe checkout" />
            <TrustItem icon={<CreditCard />} label="Cancel anytime" />
            <TrustItem icon={<Zap />} label="Upgrade only when ready" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800">
            {err && (
              <div className="col-span-full bg-[#FF3333]/10 border border-[#FF3333] text-[#FF3333] font-mono text-xs uppercase tracking-widest px-4 py-3" data-testid="pricing-error">
                {String(err)}
              </div>
            )}
            {notice && !err && (
              <div className="col-span-full bg-[#FFD600]/10 border border-[#FFD600] text-[#FFD600] font-mono text-xs uppercase tracking-widest px-4 py-3" data-testid="pricing-notice">
                {notice}
              </div>
            )}
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={`relative border-t-4 ${t.border} p-8 ${
                  t.featured ? "bg-[#111006] shadow-[0_0_0_1px_rgba(255,214,0,0.35)]" : t.muted ? "bg-zinc-950/70" : "bg-zinc-950"
                }`}
                data-testid={`pricing-${t.id}`}
              >
                {t.badge && (
                  <div className="absolute top-4 right-4 bg-[#FFD600] text-black font-mono text-[10px] uppercase tracking-widest px-2 py-1">
                    {t.badge}
                  </div>
                )}
                <div className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-2">{t.name}</div>
                <div className="font-heading text-6xl mb-1">{t.price}</div>
                <div className="font-mono text-xs text-[#FFD600] uppercase tracking-widest mb-6">{t.limit}</div>
                <div className="mb-5 border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-300">{t.note}</div>
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
                    t.id === "starter"
                      ? "bg-[#FFD600] text-black"
                      : "border border-zinc-700 text-white hover:bg-white hover:text-black"
                  }`}
                  data-testid={`pricing-cta-${t.id}`}
                >
                  {busyId === t.id ? (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <Loader2 className="w-3 h-3 animate-spin" /> Redirecting...
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2">
                      {t.cta} {t.id !== "free" && <ArrowRight className="h-3 w-3" />}
                    </span>
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

function TrustItem({ icon, label }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-950 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-zinc-300">
      <span className="text-[#FFD600]">{icon}</span>
      {label}
    </div>
  );
}
