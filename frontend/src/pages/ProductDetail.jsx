import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Download,
  ExternalLink,
  FileDown,
  Eye,
  Loader2,
  Megaphone,
  MousePointerClick,
  Pencil,
  Rocket,
  Save,
  ShieldCheck,
  ShoppingCart,
  Signal,
  Share2,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";
import AdsExportPanel from "../components/AdsExportPanel";
import TikTokPanel from "../components/TikTokPanel";
import AnalyticsPanel from "../components/AnalyticsPanel";
import FirstResultEngine from "../components/FirstResultEngine";
import ScaleUpgradePrompt from "../components/ScaleUpgradePrompt";

const LOOP = ["Build", "Launch", "Promote", "Track", "Improve"];

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [p, setP] = useState(null);
  const [draft, setDraft] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [listings, setListings] = useState([]);
  const [stores, setStores] = useState([]);
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const [launchMessage, setLaunchMessage] = useState("");

  const syncDraft = (product) => {
    setDraft({
      title: product.title || "",
      tagline: product.tagline || "",
      description: product.description || "",
      target_audience: product.target_audience || "",
      price: product.price ?? 0,
      cover_concept: product.cover_concept || "",
      bullet_features: (product.bullet_features || []).join("\n"),
      outline: (product.outline || []).join("\n"),
      sales_copy: product.sales_copy || "",
    });
  };

  const load = useCallback(async () => {
    try {
      const [prod, camps, list, st] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/campaigns?product_id=${id}`),
        api.get(`/listings?product_id=${id}`),
        api.get("/stores"),
      ]);
      setP(prod.data);
      syncDraft(prod.data);
      setCampaigns(camps.data);
      setListings(list.data.listings || []);
      setStores(st.data.stores || []);
    } catch (ex) {
      if (ex?.response?.status === 404) nav("/app/products");
    }
  }, [id, nav]);

  useEffect(() => {
    load();
  }, [load]);

  const generateCampaign = async () => {
    setErr("");
    setBusy(true);
    try {
      await api.post("/campaigns/generate", { product_id: id, angle });
      setAngle("");
      await Promise.all([load(), refresh()]);
    } catch (ex) {
      const d = ex?.response?.data?.detail;
      if (d?.code === "LIMIT_REACHED") setErr(d.message);
      else setErr(typeof d === "string" ? d : "Campaign generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveProduct = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await api.patch(`/products/${id}`, {
        title: draft.title,
        tagline: draft.tagline,
        description: draft.description,
        target_audience: draft.target_audience,
        price: Number(draft.price) || 0,
        cover_concept: draft.cover_concept,
        bullet_features: draft.bullet_features.split("\n"),
        outline: draft.outline.split("\n"),
        sales_copy: draft.sales_copy,
      });
      setP(r.data);
      syncDraft(r.data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const launchAll = async () => {
    setLaunchBusy(true);
    setLaunchMessage("");
    try {
      const r = await api.post("/launch", { product_id: id });
      await load();
      const liveCount = (r.data?.listings || []).filter((l) => l.status === "LIVE").length;
      setLaunchMessage(
        liveCount > 0
          ? `Published ${liveCount} real store listing${liveCount === 1 ? "" : "s"}.`
          : "No real listings were published. Add store credentials in Settings, then try again."
      );
    } catch (ex) {
      setLaunchMessage(ex?.response?.data?.detail || "Real publish failed. Check store credentials and try again.");
    } finally {
      setLaunchBusy(false);
    }
  };

  const download = async (kind) => {
    const path = kind === "pdf" ? `/products/${id}/download/pdf` : `/products/${id}/download/bundle`;
    const resp = await api.get(path, { responseType: "blob" });
    const blob = new Blob([resp.data], { type: kind === "pdf" ? "application/pdf" : "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = (p?.title || "product").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60);
    a.download = kind === "pdf" ? `${safe}.pdf` : `${safe}-bundle.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!p || !draft) return <div className="p-12 font-mono text-zinc-400">Loading...</div>;
  const realListings = listings.filter((l) => l.status === "LIVE" && l.real);

  return (
    <div className="p-6 lg:p-10" data-testid="product-detail-page">
      <Link to="/app/products" className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white" data-testid="back-link">
        <ArrowLeft className="h-3 w-3" /> Builder
      </Link>

      <div className="mb-8 grid gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-5">
        {LOOP.map((step, i) => (
          <div key={step} className={`p-4 ${i <= (listings.length ? 2 : 0) ? "bg-zinc-950" : "bg-black"}`}>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{String(i + 1).padStart(2, "0")}</div>
            <div className="font-heading text-2xl uppercase">{step}</div>
          </div>
        ))}
      </div>

      <SignalProofStrip productId={id} launched={realListings.length > 0} />

      <section className="mb-10 border border-zinc-800 bg-zinc-950 p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">Product draft</div>
            {editing ? (
              <div className="space-y-3">
                <EditInput value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} testid="edit-title" />
                <EditInput value={draft.tagline} onChange={(v) => setDraft({ ...draft, tagline: v })} />
                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-28 w-full border border-zinc-800 bg-black px-4 py-3 text-zinc-100 focus:border-[#FFD600] focus:outline-none" />
              </div>
            ) : (
              <>
                <h1 className="mb-3 font-heading text-5xl uppercase lg:text-6xl" data-testid="product-title">{p.title}</h1>
                <div className="mb-5 text-xl text-zinc-300">{p.tagline}</div>
                <p className="max-w-3xl text-zinc-400">{p.description}</p>
              </>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col gap-2">
            <Link to={`/app/products?remix=${id}`} className="flex items-center gap-2 border border-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-[#FFD600] transition-colors hover:bg-[#FFD600] hover:text-black">
              <Share2 className="h-4 w-4" /> Remix this product
            </Link>
            {editing ? (
              <button onClick={saveProduct} disabled={saving} className="btn-hard flex items-center gap-2 bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black disabled:opacity-60" data-testid="save-product-btn">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save edits
              </button>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 border border-zinc-700 px-5 py-3 font-mono text-xs uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black" data-testid="edit-product-btn">
                <Pencil className="h-4 w-4" /> Edit before launch
              </button>
            )}
            <button onClick={() => download("pdf")} className="btn-hard flex items-center gap-2 bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black" data-testid="download-pdf-btn">
              <FileDown className="h-4 w-4" /> Download PDF
            </button>
            <button onClick={() => download("bundle")} className="flex items-center gap-2 border border-zinc-700 px-5 py-3 font-mono text-xs uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black" data-testid="download-bundle-btn">
              <Download className="h-4 w-4" /> Full bundle
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-px border border-zinc-800 bg-zinc-800 md:grid-cols-4">
          {editing ? (
            <div className="bg-zinc-950 p-4">
              <DollarSign className="mb-2 text-[#FFD600]" />
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Price</div>
              <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="mt-1 w-full border border-zinc-800 bg-black px-2 py-2 font-heading text-2xl text-white focus:border-[#FFD600] focus:outline-none" />
            </div>
          ) : (
            <Stat icon={<DollarSign />} label="Price" value={`$${p.price}`} color="#FFD600" />
          )}
          <Stat icon={<Tag />} label="Type" value={p.product_type} color="#FFD600" />
          <Stat icon={<Users />} label="Audience" value={p.target_audience.split(",")[0]} color="#FF3333" />
          <Stat icon={<CheckCircle2 />} label="Stores live" value={p.launched_stores.length} color="#FF3333" />
        </div>
      </section>

      <div className="mb-10 grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-2">
        <Section title="Contents">
          {editing ? (
            <textarea value={draft.outline} onChange={(e) => setDraft({ ...draft, outline: e.target.value })} className="min-h-44 w-full border border-zinc-800 bg-black p-3 text-zinc-100 focus:border-[#FFD600] focus:outline-none" />
          ) : (
            <ol className="space-y-2 font-mono text-sm">
              {p.outline.map((o, i) => (
                <li key={i} className="flex gap-3 text-zinc-300">
                  <span className="text-[#FF3333]">{String(i + 1).padStart(2, "0")}</span>
                  <span>{o}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
        <Section title="Value bullets">
          {editing ? (
            <textarea value={draft.bullet_features} onChange={(e) => setDraft({ ...draft, bullet_features: e.target.value })} className="min-h-44 w-full border border-zinc-800 bg-black p-3 text-zinc-100 focus:border-[#FFD600] focus:outline-none" />
          ) : (
            <ul className="space-y-2">
              {p.bullet_features.map((b, i) => (
                <li key={i} className="flex gap-3 text-zinc-300">
                  <span className="font-mono text-xs text-[#FFD600]">-</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Cover concept">
          {editing ? (
            <textarea value={draft.cover_concept} onChange={(e) => setDraft({ ...draft, cover_concept: e.target.value })} className="min-h-24 w-full border border-zinc-800 bg-black p-3 text-zinc-100 focus:border-[#FFD600] focus:outline-none" />
          ) : (
            <p className="text-zinc-300">{p.cover_concept}</p>
          )}
        </Section>
        <Section title="Sales copy">
          {editing ? (
            <textarea value={draft.sales_copy} onChange={(e) => setDraft({ ...draft, sales_copy: e.target.value })} className="min-h-44 w-full border border-zinc-800 bg-black p-3 text-zinc-100 focus:border-[#FFD600] focus:outline-none" />
          ) : (
            <div className="whitespace-pre-line text-zinc-300">{p.sales_copy}</div>
          )}
        </Section>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-3">
        <Confidence icon={<ShieldCheck className="h-4 w-4" />} title="Why this product could work" text={`${p.target_audience.split(",")[0]} gets a specific outcome instead of another vague AI answer.`} />
        <Confidence icon={<TrendingUp className="h-4 w-4" />} title="Similar trend signal" text="Templates, checklists, and short implementation systems are easy to explain in TikTok and Meta hooks." />
        <Confidence icon={<DollarSign className="h-4 w-4" />} title="Suggested price" text={`Start at $${p.price}. Raise it after the first winner or sale appears.`} />
      </div>

      <PanelHeader title={`Ad campaigns - ${campaigns.length}`} icon={<Megaphone className="h-4 w-4 text-[#FFD600]" />}>
        <input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="angle override" className="border border-zinc-800 bg-transparent px-3 py-2 font-mono text-xs text-white focus:border-[#FFD600] focus:outline-none" data-testid="angle-input" />
        <button onClick={generateCampaign} disabled={busy} className="btn-hard flex items-center gap-2 bg-[#FFD600] px-5 py-2 font-mono text-xs uppercase tracking-widest text-black disabled:opacity-60" data-testid="generate-campaign-btn">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />} Create campaign
        </button>
      </PanelHeader>
      {err && String(err).toLowerCase().includes("upgrade") && (
        <ScaleUpgradePrompt trigger="limit" compact className="mb-0" />
      )}
      <CampaignList campaigns={campaigns} err={err} />

      <div className="mb-10 border border-zinc-800 bg-zinc-950">
        <PanelHeader title={`Real store publishing - ${realListings.length} live`} icon={<Rocket className="h-4 w-4 text-[#FF3333]" />}>
          <button onClick={launchAll} disabled={launchBusy || editing} className="btn-hard btn-hard-red flex items-center gap-2 bg-[#FF3333] px-5 py-2 font-mono text-xs uppercase tracking-widest text-white disabled:opacity-60" data-testid="launch-all-btn">
            {launchBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />} Launch product
          </button>
        </PanelHeader>
        {editing && <div className="border-b border-[#FFD600] bg-[#FFD600]/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#FFD600]">Save edits before publishing.</div>}
        {launchMessage && <div className="border-b border-[#FFD600] bg-[#FFD600]/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#FFD600]">{launchMessage}</div>}
        <StoreGrid stores={stores} listings={listings} />
      </div>

      <FirstResultEngine productId={id} launched={realListings.length > 0} />

      <WorkspaceTitle eyebrow="Analytics and winners" title="Track what is turning into money" />
      <div id="analytics-panel" className="mb-10"><AnalyticsPanel productId={id} /></div>

      <WorkspaceTitle eyebrow="Ads manager export" title="Paid traffic system" />
      <div className="mb-10"><AdsExportPanel productId={id} /></div>

      <div id="traffic-engine">
        <WorkspaceTitle eyebrow="Traffic engine" title="TikTok daily content" red />
        <TikTokPanel productId={id} />
      </div>
    </div>
  );
}

function CampaignList({ campaigns, err }) {
  return (
    <div className="mb-10 border-x border-b border-zinc-800 bg-zinc-950">
      {err && <div className="border-b border-[#FF3333] bg-[#FF3333]/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-[#FF3333]">{err}</div>}
      {campaigns.length === 0 ? (
        <div className="p-10 text-center font-mono text-xs uppercase tracking-widest text-zinc-500">Create a campaign when the offer feels ready.</div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {campaigns.map((c) => (
            <div key={c.id} className="p-6" data-testid={`campaign-${c.id}`}>
              <div className="mb-4 flex flex-wrap justify-between gap-2">
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Angle</div>
                  <div className="font-heading text-2xl uppercase">{c.angle}</div>
                </div>
                <div className="text-right">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Daily test budget</div>
                  <div className="font-heading text-2xl text-[#FFD600]">${c.daily_budget_suggestion}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {c.variants.map((v, i) => (
                  <div key={i} className="border border-zinc-800 bg-black p-4">
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FF3333]">{v.platform}</div>
                    <div className="mb-2 font-heading text-lg uppercase">{v.hook}</div>
                    <pre className="mb-3 whitespace-pre-wrap font-mono text-xs text-zinc-400">{v.script}</pre>
                    <div className="mb-2 font-mono text-xs text-[#FFD600]">{v.cta}</div>
                    <div className="mb-2 font-mono text-[10px] text-zinc-500">{v.targeting}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalProofStrip({ productId, launched }) {
  const [data, setData] = useState(null);

  const loadSignals = useCallback(async () => {
    if (!launched) return;
    try {
      const r = await api.get(`/first-result/${productId}`);
      setData(r.data);
    } catch {
      setData(null);
    }
  }, [launched, productId]);

  useEffect(() => {
    loadSignals();
    const t = setInterval(loadSignals, 10000);
    return () => clearInterval(t);
  }, [loadSignals]);

  if (!launched || !data) return null;

  const totals = data.totals || {};
  const hasActivity = (totals.clicks || 0) > 0 || (totals.sales || 0) > 0;
  const context = totals.sales
    ? "Your promotion is producing sales."
    : hasActivity
      ? "Link clicks detected from your promotion."
      : "No traffic yet. Take the next action below.";

  return (
    <div className="sticky top-0 z-10 mb-8 border border-zinc-800 bg-black/95 p-4 backdrop-blur" data-testid="signal-proof-strip">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">
            <Signal className="h-3 w-3" /> Live signal
          </div>
          <div className="text-sm text-zinc-300">{context}</div>
        </div>
        <div className="grid grid-cols-3 gap-px bg-zinc-800">
          <MiniSignal icon={<Eye />} label="Viewed" value={totals.clicks || 0} />
          <MiniSignal icon={<MousePointerClick />} label="Clicked" value={totals.clicks || 0} />
          <MiniSignal icon={<ShoppingCart />} label="Sales" value={totals.sales || 0} />
        </div>
      </div>
    </div>
  );
}

function MiniSignal({ icon, label, value }) {
  return (
    <div className="min-w-24 bg-zinc-950 px-4 py-3">
      <div className="mb-1 text-[#FFD600]">{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-heading text-2xl uppercase">{value}</div>
    </div>
  );
}

function StoreGrid({ stores, listings }) {
  return (
    <div className="grid grid-cols-1 gap-px bg-zinc-800 md:grid-cols-2 lg:grid-cols-3">
      {stores.map((s) => {
        const live = listings.find((l) => l.store_id === s.id);
        const status = live?.status;
        return (
          <div key={s.id} className="bg-zinc-950 p-5" data-testid={`store-${s.id}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-heading text-2xl uppercase">{s.name}</div>
              <span className={`whitespace-nowrap px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${status === "LIVE" ? "bg-[#FFD600] text-black" : status === "NOT_CONFIGURED" ? "border border-[#FFD600] bg-zinc-800 text-[#FFD600]" : status === "FAILED" ? "bg-[#FF3333] text-white" : "bg-zinc-800 text-zinc-400"}`}>
                {status || "READY"}
              </span>
            </div>
            {live ? (
              status === "NOT_CONFIGURED" ? (
                <Link to="/app/settings" className="font-mono text-xs text-[#FFD600] hover:text-white">Add your {s.name} key in Settings</Link>
              ) : status === "FAILED" ? (
                <div className="break-all font-mono text-xs text-[#FF3333]">{live.error}</div>
              ) : (
                <a href={live.listing_url} target="_blank" rel="noreferrer" className="flex gap-1 break-all font-mono text-xs text-zinc-300 hover:text-[#FFD600]">
                  {live.listing_url} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              )
            ) : (
              <div className="font-mono text-xs text-zinc-500">Awaiting launch</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PanelHeader({ title, icon, children }) {
  return (
    <div className="border-x border-t border-zinc-800 bg-zinc-950 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest">{icon}{title}</div>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </div>
    </div>
  );
}

function WorkspaceTitle({ eyebrow, title, red }) {
  return (
    <div className="mb-4">
      <div className={`mb-2 font-mono text-[10px] uppercase tracking-[0.28em] ${red ? "text-[#FF3333]" : "text-[#FFD600]"}`}>{eyebrow}</div>
      <h2 className="font-heading text-3xl uppercase lg:text-4xl">{title}</h2>
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="bg-zinc-950 p-4">
      <div style={{ color }} className="mb-2">{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div className="truncate font-heading text-2xl uppercase">{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-zinc-950 p-6">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">{title}</div>
      {children}
    </div>
  );
}

function Confidence({ icon, title, text }) {
  return (
    <div className="bg-zinc-950 p-6">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">{icon}{title}</div>
      <p className="text-sm text-zinc-300">{text}</p>
    </div>
  );
}

function EditInput({ value, onChange, testid }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="w-full border border-zinc-800 bg-black px-4 py-3 text-zinc-100 focus:border-[#FFD600] focus:outline-none" />
  );
}
