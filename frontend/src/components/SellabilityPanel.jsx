import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Flame,
  Gauge,
  Loader2,
  LockKeyhole,
  MousePointerClick,
  ShoppingCart,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import api from "../api";

const FIXES = [
  ["title", "Fix title"],
  ["offer", "Fix offer"],
  ["hooks", "Fix hooks"],
  ["sales_copy", "Fix sales copy"],
  ["video_script", "Fix video script"],
  ["price", "Fix price"],
];

const SCORE_LABELS = {
  buyer_pain_clarity: "Buyer pain",
  offer_strength: "Offer",
  hook_strength: "Hook",
  title_strength: "Title",
  sales_page_clarity: "Sales page",
  video_quality: "Video",
  price_fit: "Price",
  conversion_likelihood: "Conversion",
  first_sale_probability: "First sale",
};

export default function SellabilityPanel({ productId, product, locked, onUnlock, onProductUpdated }) {
  const [review, setReview] = useState(null);
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!productId) return;
    setErr("");
    try {
      const [reviewRes, auditRes] = await Promise.allSettled([
        api.get(`/products/${productId}/sellability`),
        api.post("/billing/product-unlock-audit", { product_id: productId, origin_url: window.location.origin }),
      ]);
      if (reviewRes.status === "fulfilled") setReview(reviewRes.value.data);
      if (auditRes.status === "fulfilled") setAudit(auditRes.value.data);
    } catch {
      setErr("Sellability review failed.");
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFix = async (aspect) => {
    if (locked) {
      onUnlock?.();
      return;
    }
    setBusy(aspect);
    setErr("");
    try {
      const r = await api.post(`/products/${productId}/fix`, { aspect });
      setReview(r.data.review);
      onProductUpdated?.(r.data.product);
      await load();
    } catch (ex) {
      const detail = ex?.response?.data?.detail;
      setErr(typeof detail === "string" ? detail : "Fix failed.");
    } finally {
      setBusy("");
    }
  };

  const scoreRows = Object.entries(review?.scores || {});
  const score = review?.sellability_score ?? product?.completeness_score ?? 0;
  const metrics = review?.real_metrics || {};
  const priorityAspect = review?.priority_fix?.aspect;

  return (
    <section className="mb-10 border border-zinc-800 bg-zinc-950" data-testid="sellability-panel">
      <div className="grid grid-cols-1 gap-px bg-zinc-800 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-zinc-950 p-6">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">
            <Gauge className="h-3 w-3" /> Sellability review engine
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-heading text-6xl uppercase leading-none text-[#FFD600]">{score}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Score out of 100</div>
            </div>
            <StageBadge label={review?.stage || "Loading"} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px bg-zinc-800 md:grid-cols-4">
            <Metric icon={<Eye />} label="Impressions" value={metrics.impressions || 0} />
            <Metric icon={<MousePointerClick />} label="Clicks" value={metrics.clicks || 0} />
            <Metric icon={<ShoppingCart />} label="Sales" value={metrics.sales || 0} />
            <Metric icon={<CheckCircle2 />} label="Revenue" value={`$${metrics.revenue || 0}`} />
          </div>

          <div className="mt-5 border border-[#FFD600]/40 bg-black p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
              <Target className="h-3 w-3" /> Exact next action
            </div>
            <p className="text-sm text-zinc-200">{review?.exact_next_action || "Loading the next best action."}</p>
          </div>

          <div className="mt-5 border border-zinc-800 bg-black p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
              <Flame className="h-3 w-3" /> Best first hook
            </div>
            <p className="font-heading text-2xl uppercase leading-tight">{review?.best_first_hook || product?.tagline}</p>
          </div>

          <div className="mt-5 text-xs text-zinc-500">{review?.no_fake_numbers_note || "Only real tracked events count here."}</div>
        </div>

        <div className="bg-zinc-950 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FF3333]">Priority fix</div>
              <div className="font-heading text-3xl uppercase">{review?.priority_fix?.what || "Loading"}</div>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">{review?.priority_fix?.why}</p>
            </div>
          </div>

          {err && <div className="mb-4 border border-[#FF3333] bg-[#FF3333]/10 px-4 py-3 font-mono text-xs uppercase tracking-widest text-[#FF3333]">{err}</div>}

          <div className="mb-5 flex flex-wrap gap-2">
            {FIXES.map(([aspect, label]) => (
              <button
                key={aspect}
                onClick={() => applyFix(aspect)}
                disabled={Boolean(busy)}
                className={`inline-flex items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-widest disabled:opacity-60 ${
                  priorityAspect === aspect
                    ? "bg-[#FFD600] text-black"
                    : "border border-zinc-700 text-white hover:bg-white hover:text-black"
                }`}
                data-testid={`fix-${aspect}`}
              >
                {busy === aspect ? <Loader2 className="h-3 w-3 animate-spin" /> : locked ? <LockKeyhole className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                {label}
              </button>
            ))}
          </div>

          <div className="mb-5 grid grid-cols-1 gap-2 md:grid-cols-3">
            {(review?.top_3_blockers || []).map((b, i) => (
              <div key={`${b.aspect}-${i}`} className="border border-zinc-800 bg-black p-4">
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FF3333]">
                  <AlertTriangle className="h-3 w-3" /> {b.impact}
                </div>
                <div className="mb-2 font-heading text-xl uppercase">{b.what}</div>
                <p className="text-xs leading-relaxed text-zinc-400">{b.why}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {(review?.first_sale_path || []).map((step) => (
              <div key={step.step} className="border border-zinc-800 bg-black p-4">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Step {step.step}: {step.label}</div>
                <p className="text-sm text-zinc-300">{step.action}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px bg-zinc-800 lg:grid-cols-3">
            {scoreRows.map(([key, value]) => (
              <ScoreCell key={key} label={SCORE_LABELS[key] || key} value={value} />
            ))}
          </div>
        </div>
      </div>

      <UnlockPreview
        locked={locked}
        price={product?.unlock_price_usd || 9}
        audit={audit}
        onUnlock={onUnlock}
      />
    </section>
  );
}

function UnlockPreview({ locked, price, audit, onUnlock }) {
  const checks = audit?.checks || [];
  return (
    <div className="border-t border-zinc-800 bg-black p-6" data-testid="unlock-preview-page">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">Unlock preview page</div>
          <div className="font-heading text-3xl uppercase">{locked ? `Unlock the complete package for $${price}` : "Complete package access is active"}</div>
        </div>
        <button onClick={onUnlock} className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black">
          {locked ? <LockKeyhole className="h-4 w-4" /> : <Download className="h-4 w-4" />} {locked ? "Unlock package" : "Download assets above"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-px bg-zinc-800 md:grid-cols-4">
        {["Full product PDF", "Store upload bundle", "Cover PNG", "3 ad video styles"].map((item, i) => (
          <div key={item} className={`bg-zinc-950 p-4 ${locked && i > 0 ? "opacity-45 blur-[1px]" : ""}`}>
            <div className="mb-2 text-[#FFD600]"><Sparkles className="h-4 w-4" /></div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-300">{item}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
        {checks.map((c) => (
          <div key={c.name} className="border border-zinc-800 bg-zinc-950 p-3">
            <div className={`mb-1 font-mono text-[10px] uppercase tracking-widest ${c.ok ? "text-[#FFD600]" : "text-[#FF3333]"}`}>{c.ok ? "Ready" : "Needs setup"}</div>
            <div className="text-xs text-zinc-400">{c.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="bg-zinc-950 p-4">
      <div className="mb-2 text-[#FFD600]">{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-heading text-2xl uppercase">{value}</div>
    </div>
  );
}

function ScoreCell({ label, value }) {
  return (
    <div className="bg-black p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`font-heading text-2xl uppercase ${value >= 75 ? "text-[#FFD600]" : value >= 55 ? "text-white" : "text-[#FF3333]"}`}>{value}</div>
    </div>
  );
}

function StageBadge({ label }) {
  return (
    <div className="border border-[#FFD600] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
      {label}
    </div>
  );
}
