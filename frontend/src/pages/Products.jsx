import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import ScaleUpgradePrompt from "../components/ScaleUpgradePrompt";
import { startStepTimer, trackOnboarding } from "../lib/onboardingTelemetry";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Flame,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  PlaySquare,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  WandSparkles,
} from "lucide-react";

const TYPES = [
  { id: "ebook", label: "Ebook" },
  { id: "course", label: "Mini course" },
  { id: "notion_template", label: "Notion template" },
  { id: "prompt_pack", label: "Prompt pack" },
  { id: "template", label: "Template bundle" },
];

const STYLES = ["Beginner-friendly", "Aggressive marketing", "Luxury", "Minimal", "Operator-focused"];
const LOOP = ["Build", "Launch", "Promote", "Track", "Improve"];

function winningExamples(niche, productType, style) {
  const topic = niche?.trim() || "AI side hustles";
  const typeLabel = TYPES.find((t) => t.id === productType)?.label || "Digital product";
  return [
    {
      title: `${topic} Starter System`,
      promise: `A practical ${typeLabel.toLowerCase()} for buyers who want a first win this week.`,
      price: "$19-$29",
      reason: "Low friction offer, clear outcome, easy to promote with short-form hooks.",
    },
    {
      title: `${topic} 30-Day Blueprint`,
      promise: `A guided plan with daily actions, checklists, and simple progress milestones.`,
      price: "$27-$49",
      reason: "Plans sell because the buyer can imagine finishing them.",
    },
    {
      title: `${topic} Swipe File`,
      promise: `Ready-to-use examples, prompts, scripts, and templates in a ${style.toLowerCase()} voice.`,
      price: "$17-$37",
      reason: "Fast perceived value: the customer can use it immediately.",
    },
    {
      title: `${topic} Premium Kit`,
      promise: "A higher-value bundle with worksheets, launch copy, and a monetization checklist.",
      price: "$49-$97",
      reason: "Bundles justify a stronger price and create more launch angles.",
    },
  ];
}

export default function Products() {
  const { refresh, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [productType, setProductType] = useState("ebook");
  const [style, setStyle] = useState(STYLES[0]);
  const [mode, setMode] = useState("guided");
  const [direction, setDirection] = useState(0);
  const [priceHint, setPriceHint] = useState("$27");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [latest, setLatest] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const remixId = searchParams.get("remix");
  const batch = searchParams.get("batch");
  const isFree = (user?.plan || "free") === "free";
  const firstRun = items.length === 0 && !remixId;

  const examples = useMemo(() => winningExamples(niche, productType, style), [niche, productType, style]);
  const chosen = examples[direction] || examples[0];

  const load = async () => {
    const r = await api.get("/products");
    setItems(r.data);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return startStepTimer(firstRun ? "choose_niche" : "builder");
  }, [firstRun]);

  useEffect(() => {
    if (!remixId) return;
    (async () => {
      try {
        const r = await api.get(`/products/${remixId}`);
        const product = r.data;
        setNiche(product.target_audience || product.title || "");
        setAudience(product.target_audience || "");
        setProductType(product.product_type || "ebook");
        setPriceHint(`$${product.price || 27}`);
        setStyle("Operator-focused");
        setNotes([
          `Remix structure from: ${product.title}`,
          `Keep this outline: ${(product.outline || []).join(" | ")}`,
          batch === "5" ? "Create this as the first of five similar launch angles." : "Make it feel adjacent, not identical.",
        ].join("\n"));
      } catch {
        // Remix is a speed path; if the source is unavailable the normal builder still works.
      }
    })();
  }, [remixId, batch]);

  const generate = async (e) => {
    e.preventDefault();
    setErr("");
    if (!niche.trim()) {
      setErr("Pick a niche before building.");
      trackOnboarding("onboarding_dropoff_risk", { step: "choose_niche", reason: "empty_niche_submit" });
      return;
    }
    setBusy(true);
    trackOnboarding("first_action_started", { step: "build_product", fma: "product_created" });
    try {
      const extra = [
        `Direction: ${chosen.title}`,
        `Promise: ${chosen.promise}`,
        `Style: ${style}`,
        `Mode: ${mode}`,
        notes && `User notes: ${notes}`,
      ]
        .filter(Boolean)
        .join("\n");
      const r = await api.post("/products/generate", {
        niche,
        audience,
        product_type: productType,
        price_hint: priceHint,
        extra_notes: extra,
      });
      setLatest(r.data);
      trackOnboarding("first_meaningful_action_completed", { fma: "product_created", product_id: r.data.id });
      setNiche("");
      setAudience("");
      setNotes("");
      await Promise.all([load(), refresh()]);
    } catch (ex) {
      const detail = ex?.response?.data?.detail;
      if (detail?.code === "LIMIT_REACHED") setErr(detail.message);
      else setErr(typeof detail === "string" ? detail : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product and its campaigns/listings?")) return;
    await api.delete(`/products/${id}`);
    if (latest?.id === id) setLatest(null);
    load();
  };

  const downloadAll = async () => {
    if (items.length === 0) return;
    const resp = await api.get("/products/download/all", { responseType: "blob" });
    const blob = new Blob([resp.data], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fiilthy-library.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadProductAsset = async (product, kind) => {
    if (product.is_unlocked === false) {
      await unlockProduct(product);
      return;
    }
    const map = {
      bundle: { path: `/products/${product.id}/download/bundle`, type: "application/zip", suffix: "store-upload-bundle.zip" },
      cover: { path: `/products/${product.id}/download/cover`, type: "image/png", suffix: "cover.png" },
      videos: { path: `/products/${product.id}/promo-videos.zip`, type: "application/zip", suffix: "promo-videos.zip" },
    };
    const cfg = map[kind];
    if (!cfg) return;
    const resp = await api.get(cfg.path, { responseType: "blob" });
    const blob = new Blob([resp.data], { type: cfg.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (product.title || "product").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60);
    a.download = `${safe}-${cfg.suffix}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const unlockProduct = async (product) => {
    const r = await api.post("/billing/create-product-checkout", {
      product_id: product.id,
      origin_url: window.location.origin,
    });
    window.location.href = r.data.url;
  };

  return (
    <div className="p-6 lg:p-10" data-testid="products-page">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">
            Product quality workspace
          </div>
          <h1 className="font-heading text-5xl uppercase lg:text-6xl">Build something sellable</h1>
          <p className="mt-2 max-w-3xl text-zinc-400">
            Every product should contain a clear buyer, useful deliverable, store-ready description, cover, sales copy, and promo assets before automation touches it.
          </p>
        </div>
        {items.length > 0 && !firstRun && (
          <button
            onClick={downloadAll}
            className="flex items-center gap-2 border border-zinc-700 px-5 py-3 font-mono text-xs uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black"
            data-testid="download-all-btn"
          >
            <Download className="h-4 w-4" /> Download library
          </button>
        )}
      </div>

      <div className="mb-8 grid gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-3">
        {["Pick buyer", "Complete product", "Prove sellability"].map((step, i) => (
          <div key={step} className="bg-zinc-950 p-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="font-heading text-2xl uppercase">{step}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 xl:grid-cols-12">
        <form onSubmit={generate} className={`bg-zinc-950 p-6 ${firstRun ? "xl:col-span-12" : "xl:col-span-5"}`}>
          {batch === "5" && isFree && (
            <ScaleUpgradePrompt trigger="batch" compact className="mb-5" />
          )}
          {remixId && (
            <div className="mb-5 border border-[#FFD600] bg-[#FFD600]/10 p-4">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Remix mode</div>
              <div className="text-sm text-zinc-300">
                Structure loaded. Adjust the angle, then launch a related product fast.
              </div>
            </div>
          )}
          <StepLabel n="01" label="Pick the buyer and outcome" />
          <Field label="What niche do you want?" value={niche} onChange={setNiche} placeholder="Fitness plans for busy founders" testid="niche-input" />

          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-[#FFD600]"
          >
            {advancedOpen ? "Hide optional settings" : "Optional settings"}
          </button>

          {advancedOpen && (
            <>
              <Field label="Who is buying?" value={audience} onChange={setAudience} placeholder="Beginners, creators, operators, parents..." testid="audience-input" />
              <label className="mb-4 block">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">Product type</span>
                <select value={productType} onChange={(e) => setProductType(e.target.value)} className="w-full border border-zinc-800 bg-transparent px-4 py-3 font-mono text-sm text-white focus:border-[#FFD600] focus:outline-none" data-testid="type-select">
                  {TYPES.map((t) => (
                    <option key={t.id} value={t.id} className="bg-zinc-950">
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mb-4">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">Style</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {STYLES.map((s) => (
                    <button type="button" key={s} onClick={() => setStyle(s)} className={`border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider transition-colors ${style === s ? "border-[#FFD600] bg-[#FFD600] text-black" : "border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Suggested price" value={priceHint} onChange={setPriceHint} placeholder="$27" testid="price-input" />
              <label className="mb-4 block">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">Quick notes</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Make it simple, include a checklist..." className="min-h-24 w-full border border-zinc-800 bg-transparent px-4 py-3 font-mono text-sm text-white focus:border-[#FFD600] focus:outline-none" />
              </label>
            </>
          )}

          {err && <div className="mb-4 border border-[#FF3333] bg-[#FF3333]/10 px-4 py-3 font-mono text-xs uppercase tracking-widest text-[#FF3333]" data-testid="product-error">{err}</div>}
          {err && err.toLowerCase().includes("upgrade") && <ScaleUpgradePrompt trigger="limit" compact className="mb-4" />}

          <button type="submit" disabled={busy} className="btn-hard flex w-full items-center justify-center gap-2 bg-[#FFD600] py-4 font-mono text-sm uppercase tracking-widest text-black disabled:opacity-60" data-testid="generate-product-btn">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Building..." : "Build sellable product"}
          </button>
        </form>

        {!firstRun && <div className="bg-zinc-950 p-6 xl:col-span-4">
          <StepLabel n="03" label="Pick a sellable direction" />
          <div className="space-y-3">
            {examples.map((ex, i) => (
              <button
                key={ex.title}
                type="button"
                onClick={() => setDirection(i)}
                className={`w-full border p-4 text-left transition-colors ${
                  direction === i ? "border-[#FFD600] bg-[#FFD600]/10" : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-heading text-2xl uppercase">{ex.title}</div>
                  {direction === i && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#FFD600]" />}
                </div>
                <p className="mb-3 text-sm text-zinc-300">{ex.promise}</p>
                <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest">
                  <span className="bg-zinc-900 px-2 py-1 text-[#FFD600]">{ex.price}</span>
                  <span className="bg-zinc-900 px-2 py-1 text-zinc-400">{ex.reason}</span>
                </div>
              </button>
            ))}
          </div>
        </div>}

        {!firstRun && <div className="bg-zinc-950 p-6 xl:col-span-3">
          <StepLabel n="04" label="Sellability check" />
          <div className="space-y-4">
            <Insight icon={<Target />} title="Why this could work" text={chosen.reason} />
            <Insight icon={<Flame />} title="Trend signal" text={`${niche || "This niche"} is easy to test with hooks, templates, and visible before-after outcomes.`} />
            <Insight icon={<PackageCheck />} title="Suggested price" text={`${chosen.price}. Start accessible, then raise price when clicks and sales show demand.`} />
          </div>

          {latest && (
            <div className="mt-6 border border-[#FFD600] bg-[#FFD600]/5 p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Draft ready</div>
              <div className="font-heading text-2xl uppercase">{latest.title}</div>
              <p className="mt-1 text-sm text-zinc-300">{latest.tagline}</p>
              <Link to={`/app/products/${latest.id}`} className="mt-4 inline-flex items-center gap-2 bg-[#FF3333] px-4 py-3 font-mono text-xs uppercase tracking-widest text-white btn-hard btn-hard-red">
                Review and launch <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>}
      </div>

      {latest && firstRun && (
        <div className="mt-8 border border-[#FFD600] bg-[#FFD600]/10 p-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">First action complete</div>
          <div className="font-heading text-3xl uppercase">{latest.title}</div>
          <p className="mt-1 text-sm text-zinc-300">Next step: review quality, then launch.</p>
          <Link to={`/app/products/${latest.id}`} className="btn-hard btn-hard-red mt-4 inline-flex items-center gap-2 bg-[#FF3333] px-5 py-3 font-mono text-xs uppercase tracking-widest text-white">
            Review product <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {!firstRun && <div className="mt-10 border border-zinc-800 bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-6 py-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest">Product inventory - {items.length}</div>
            <div className="mt-1 text-sm text-zinc-400">Every card is organized around quality, clarity, completeness, and real sellability assets.</div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Quality first, automate last</div>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center font-mono text-xs uppercase tracking-widest text-zinc-500">
            No products yet. Choose a direction and build the first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-px bg-zinc-800 xl:grid-cols-2">
            {items.map((p) => (
              <ProductInventoryCard
                key={p.id}
                product={p}
                onDelete={del}
                onDownload={downloadProductAsset}
                onUnlock={unlockProduct}
              />
            ))}
          </div>
        )}
      </div>}
    </div>
  );
}

function ProductInventoryCard({ product: p, onDelete, onDownload, onUnlock }) {
  const complete = Math.max(0, Math.min(100, p.completeness_score || 100));
  const videoCount = Math.max(3, p.tiktok_posts_count || 3);
  const locked = p.is_unlocked === false;
  const status = locked ? "Preview locked" : p.winners?.length ? "Winning product" : p.launched_stores?.length ? "Live test" : "Manual ready";

  return (
    <div className="bg-zinc-950 p-5" data-testid={`product-row-${p.id}`}>
      <div className="grid gap-5 md:grid-cols-[160px_1fr]">
        <ProductCoverPreview product={p} />
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 ${p.launched_stores?.length ? "bg-[#FFD600] text-black" : "bg-zinc-800 text-zinc-300"}`}>
              {status}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">${p.price}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{p.product_type}</span>
          </div>

          <Link to={`/app/products/${p.id}`} className="group block">
            <div className="font-heading text-3xl uppercase leading-none group-hover:text-[#FFD600]">{p.title}</div>
            <div className="mt-2 text-sm text-zinc-300">{p.tagline}</div>
          </Link>

          <div className="mt-4 border border-zinc-800 bg-black p-3">
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
              <ShoppingBag className="h-3 w-3" /> Store description
            </div>
            <p className="line-clamp-3 text-sm text-zinc-400">{p.description}</p>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Product completeness</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">{complete}%</div>
            </div>
            <div className="h-2 bg-zinc-800">
              <div className="h-2 bg-[#FFD600]" style={{ width: `${complete}%` }} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <AssetPill icon={<FileText className="h-3 w-3" />} label="Full product" />
            <AssetPill icon={<ShoppingBag className="h-3 w-3" />} label="Store copy" />
            <AssetPill icon={<ImageIcon className="h-3 w-3" />} label="Cover PNG" />
            <AssetPill icon={<PlaySquare className="h-3 w-3" />} label={`${videoCount} videos`} />
            <AssetPill icon={<Flame className="h-3 w-3" />} label="Ad copy" />
          </div>

          {locked && (
            <div className="mt-4 border border-[#FFD600] bg-[#FFD600]/10 p-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Premium preview</div>
              <p className="mt-1 text-sm text-zinc-300">Unlock this complete product package for ${p.unlock_price_usd || 9} to reveal all content, downloads, cover, and videos.</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={`/app/products/${p.id}`} className="btn-hard btn-hard-red inline-flex items-center gap-2 bg-[#FF3333] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white" data-testid={`open-${p.id}`}>
              Open <ArrowRight className="h-3 w-3" />
            </Link>
            {locked && (
              <button onClick={() => onUnlock(p)} className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-black">
                Unlock ${p.unlock_price_usd || 9}
              </button>
            )}
            <button onClick={() => onDownload(p, "bundle")} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
              <Download className="h-3 w-3" /> Bundle
            </button>
            <button onClick={() => onDownload(p, "videos")} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
              <PlaySquare className="h-3 w-3" /> Videos
            </button>
            <button onClick={() => onDownload(p, "cover")} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
              <ImageIcon className="h-3 w-3" /> Cover
            </button>
            <button onClick={() => onDelete(p.id)} className="ml-auto inline-flex items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-[#FF3333]" title="Delete" data-testid={`delete-${p.id}`}>
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCoverPreview({ product }) {
  const words = (product.title || "Digital Product").split(/\s+/).slice(0, 5).join(" ");
  return (
    <div className="aspect-[2/3] border border-zinc-800 bg-black p-3">
      <div className="flex h-full flex-col justify-between border border-zinc-700 bg-[#09090b] p-4">
        <div>
          <div className="mb-3 h-2 bg-[#FFD600]" />
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFD600]">FiiLTHY.AI</div>
        </div>
        <div>
          <div className="font-heading text-3xl uppercase leading-none text-white">{words}</div>
          <div className="mt-3 h-1 w-16 bg-[#FF3333]" />
          <div className="mt-3 line-clamp-3 text-[11px] leading-snug text-zinc-400">{product.cover_concept || product.tagline}</div>
        </div>
        <div className="bg-[#FFD600] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-black">
          Cover ready
        </div>
      </div>
    </div>
  );
}

function AssetPill({ icon, label }) {
  return (
    <div className="flex min-h-12 items-center gap-2 border border-zinc-800 bg-black px-2 py-2 font-mono text-[9px] uppercase tracking-widest text-zinc-300">
      <span className="text-[#FFD600]">{icon}</span>
      <span className="leading-tight">{label}</span>
    </div>
  );
}

function StepLabel({ n, label }) {
  return (
    <div className="mb-5 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-zinc-400">
      <span className="bg-[#FFD600] px-2 py-1 text-black">{n}</span>
      {label}
    </div>
  );
}

function Field({ label, value, onChange, testid, ...rest }) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">{label}</span>
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="w-full border border-zinc-800 bg-transparent px-4 py-3 font-mono text-sm text-white focus:border-[#FFD600] focus:outline-none" />
    </label>
  );
}

function Insight({ icon, title, text }) {
  return (
    <div className="border border-zinc-800 bg-black p-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
        {icon}
        {title}
      </div>
      <p className="text-sm text-zinc-300">{text}</p>
    </div>
  );
}
