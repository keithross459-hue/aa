import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";
import { Loader2, Megaphone, Rocket, ArrowLeft, Tag, Users, DollarSign, ExternalLink, CheckCircle2, Download, FileDown } from "lucide-react";
import AdsExportPanel from "../components/AdsExportPanel";
import TikTokPanel from "../components/TikTokPanel";
import AnalyticsPanel from "../components/AnalyticsPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [p, setP] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [listings, setListings] = useState([]);
  const [stores, setStores] = useState([]);
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [prod, camps, list, st] = await Promise.all([
        api.get(`/products/${id}`),
        api.get(`/campaigns?product_id=${id}`),
        api.get(`/listings?product_id=${id}`),
        api.get(`/stores`),
      ]);
      setP(prod.data);
      setCampaigns(camps.data);
      setListings(list.data.listings || []);
      setStores(st.data.stores || []);
    } catch (ex) {
      if (ex?.response?.status === 404) nav("/app/products");
    }
  }, [id, nav]);
  useEffect(() => { load(); }, [load]);

  const generateCampaign = async () => {
    setErr(""); setBusy(true);
    try {
      await api.post("/campaigns/generate", { product_id: id, angle });
      setAngle("");
      await Promise.all([load(), refresh()]);
    } catch (ex) {
      const d = ex?.response?.data?.detail;
      if (d?.code === "LIMIT_REACHED") setErr(d.message);
      else setErr(typeof d === "string" ? d : "Campaign generation failed.");
    } finally { setBusy(false); }
  };

  const launchAll = async () => {
    setLaunchBusy(true);
    try {
      await api.post("/launch", { product_id: id });
      await load();
    } finally { setLaunchBusy(false); }
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

  if (!p) return <div className="p-12 text-zinc-400 font-mono">Loading…</div>;

  return (
    <div className="p-8 lg:p-12" data-testid="product-detail-page">
      <Link to="/app/products" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white mb-6" data-testid="back-link">
        <ArrowLeft className="w-3 h-3" /> All products
      </Link>

      {/* Header */}
      <div className="border border-zinc-800 bg-zinc-950 p-8 mb-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Product</div>
            <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-3" data-testid="product-title">{p.title}</h1>
            <div className="text-xl text-zinc-300 mb-6">{p.tagline}</div>
            <p className="text-zinc-400 max-w-3xl mb-6">{p.description}</p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => download("pdf")}
              className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-5 py-3 btn-hard flex items-center gap-2 whitespace-nowrap"
              data-testid="download-pdf-btn"
            >
              <FileDown className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={() => download("bundle")}
              className="border border-zinc-700 text-white font-mono text-xs uppercase tracking-widest px-5 py-3 hover:bg-white hover:text-black transition-colors flex items-center gap-2 whitespace-nowrap"
              data-testid="download-bundle-btn"
            >
              <Download className="w-4 h-4" /> Full Bundle (.zip)
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800">
          <Stat icon={<DollarSign />} label="Price" value={`$${p.price}`} color="#FFD600" />
          <Stat icon={<Tag />} label="Type" value={p.product_type} color="#FFD600" />
          <Stat icon={<Users />} label="Audience" value={p.target_audience.split(",")[0]} color="#FF3333" />
          <Stat icon={<CheckCircle2 />} label="Stores live" value={p.launched_stores.length} color="#FF3333" />
        </div>
      </div>

      {/* Outline + Sales copy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 mb-10">
        <Section title="Bullet features">
          <ul className="space-y-2">
            {p.bullet_features.map((b, i) => (
              <li key={i} className="flex gap-3 text-zinc-300">
                <span className="text-[#FFD600] font-mono text-xs">▮</span><span>{b}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Outline">
          <ol className="space-y-2 font-mono text-sm">
            {p.outline.map((o, i) => (
              <li key={i} className="flex gap-3 text-zinc-300">
                <span className="text-[#FF3333]">{String(i + 1).padStart(2, "0")}</span><span>{o}</span>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Sales copy" full>
          <div className="text-zinc-300 whitespace-pre-line">{p.sales_copy}</div>
        </Section>
      </div>

      {/* Campaigns */}
      <div className="border border-zinc-800 bg-zinc-950 mb-10">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#FFD600]" /> Ad campaigns — {campaigns.length}
          </div>
          <div className="flex items-center gap-3">
            <input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="optional angle override"
              className="bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-xs focus:border-[#FFD600] focus:outline-none"
              data-testid="angle-input"
            />
            <button
              onClick={generateCampaign}
              disabled={busy}
              className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-5 py-2 btn-hard disabled:opacity-60 flex items-center gap-2"
              data-testid="generate-campaign-btn"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Megaphone className="w-3 h-3" />}
              Generate campaign
            </button>
          </div>
        </div>
        {err && (
          <div className="bg-[#FF3333]/10 border-b border-[#FF3333] text-[#FF3333] font-mono text-xs uppercase tracking-widest px-6 py-3" data-testid="campaign-error">
            {err}
          </div>
        )}
        {campaigns.length === 0 ? (
          <div className="p-10 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">No campaigns yet. Generate one →</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {campaigns.map((c) => (
              <div key={c.id} className="p-6" data-testid={`campaign-${c.id}`}>
                <div className="flex justify-between flex-wrap gap-2 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Angle</div>
                    <div className="font-heading text-2xl uppercase">{c.angle}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Daily budget</div>
                    <div className="font-heading text-2xl text-[#FFD600]">${c.daily_budget_suggestion}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {c.variants.map((v, i) => (
                    <div key={i} className="border border-zinc-800 bg-black p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-[#FF3333]">{v.platform}</span>
                      </div>
                      <div className="font-heading text-lg uppercase mb-2">{v.hook}</div>
                      <pre className="text-zinc-400 text-xs whitespace-pre-wrap font-mono mb-3">{v.script}</pre>
                      <div className="font-mono text-xs text-[#FFD600] mb-2">→ {v.cta}</div>
                      <div className="font-mono text-[10px] text-zinc-500 mb-2">{v.targeting}</div>
                      <div className="flex flex-wrap gap-1">
                        {v.hashtags.slice(0, 8).map((h, hi) => (
                          <span key={hi} className="font-mono text-[10px] text-zinc-300 bg-zinc-900 px-2 py-0.5">#{h}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Launch */}
      <div className="border border-zinc-800 bg-zinc-950 mb-10">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
          <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
            <Rocket className="w-4 h-4 text-[#FF3333]" /> Multi-store launch — {listings.length} live
          </div>
          <button
            onClick={launchAll}
            disabled={launchBusy}
            className="bg-[#FF3333] text-white font-mono text-xs uppercase tracking-widest px-5 py-2 btn-hard btn-hard-red disabled:opacity-60 flex items-center gap-2"
            data-testid="launch-all-btn"
          >
            {launchBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
            Launch to all stores
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-800">
          {stores.map((s) => {
            const live = listings.find((l) => l.store_id === s.id);
            const status = live?.status;
            return (
              <div key={s.id} className="bg-zinc-950 p-5" data-testid={`store-${s.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-heading text-2xl uppercase">{s.name}</div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 whitespace-nowrap ${
                      status === "LIVE" ? "bg-[#FFD600] text-black" :
                      status === "SIMULATED" ? "bg-zinc-700 text-zinc-200" :
                      status === "NOT_CONFIGURED" ? "bg-zinc-800 text-[#FFD600] border border-[#FFD600]" :
                      status === "FAILED" ? "bg-[#FF3333] text-white" :
                      "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {status || "READY"}
                  </span>
                </div>
                {live ? (
                  status === "NOT_CONFIGURED" ? (
                    <Link to="/app/settings" className="font-mono text-xs text-[#FFD600] hover:text-white">
                      Add your {s.name} key in Settings →
                    </Link>
                  ) : status === "FAILED" ? (
                    <div className="font-mono text-xs text-[#FF3333] break-all">{live.error}</div>
                  ) : (
                    <a href={live.listing_url} target="_blank" rel="noreferrer" className="font-mono text-xs text-zinc-300 hover:text-[#FFD600] flex items-center gap-1 break-all">
                      {live.listing_url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  )
                ) : (
                  <div className="font-mono text-xs text-zinc-500">Awaiting launch</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ads export — manual launch bridge */}
      <div className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Analytics & winners</div>
        <h2 className="font-heading text-3xl lg:text-4xl uppercase mb-4">Which content is actually printing?</h2>
        <AnalyticsPanel productId={id} />
      </div>

      {/* Ads export — manual launch bridge */}
      <div className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Ads manager export</div>
        <h2 className="font-heading text-3xl lg:text-4xl uppercase mb-4">Launch paid ads in 2 clicks</h2>
        <AdsExportPanel productId={id} />
      </div>

      {/* TikTok content engine */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF3333] mb-2">▮ Traffic engine</div>
        <h2 className="font-heading text-3xl lg:text-4xl uppercase mb-4">TikTok daily content</h2>
        <TikTokPanel productId={id} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="bg-zinc-950 p-4">
      <div style={{ color }} className="mb-2">{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div className="font-heading text-2xl uppercase truncate">{value}</div>
    </div>
  );
}

function Section({ title, children, full }) {
  return (
    <div className={`bg-zinc-950 p-6 ${full ? "lg:col-span-2" : ""}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">▮ {title}</div>
      {children}
    </div>
  );
}
