import { useEffect, useState } from "react";
import api from "../api";
import {
  Loader2,
  Copy,
  ExternalLink,
  Flame,
  Target,
  Megaphone,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

function copy(text, onDone) {
  navigator.clipboard.writeText(text).then(() => {
    onDone?.();
  });
}

export default function AdsExportPanel({ productId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const flash = (k) => {
    setCopiedKey(k);
    setTimeout(() => setCopiedKey(""), 1400);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/meta/export/${productId}`);
        setData(r.data);
      } catch (ex) {
        setErr(ex?.response?.data?.detail || "Failed to load export");
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  if (loading) {
    return (
      <div className="p-10 flex items-center gap-3 text-zinc-400 font-mono text-xs uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading export...
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="p-6 text-zinc-500 font-mono text-xs uppercase tracking-widest">
        {err || "No export available yet."}
      </div>
    );
  }

  const adsManagerUrl = data.ads_manager_url || "https://adsmanager.facebook.com/adsmanager/manage/campaigns";

  const bundleText = () => {
    const out = [];
    out.push(`CAMPAIGN\nName: ${data.campaign.name}\nObjective: ${data.campaign.objective}\n`);
    out.push(
      `TARGETING\nLocations: ${data.targeting.locations.join(", ")}\nAudience: ${
        data.targeting.type
      }\nOptimization: ${data.targeting.optimization || "Conversions"}\n`
    );
    data.creatives.forEach((c, i) => {
      out.push(
        `AD #${i + 1}${c.recommended ? "  RECOMMENDED" : ""}\nHeadline:\n${c.headline}\n\nPrimary Text:\n${c.primary_text}\n\nImage: ${c.image_url}\n`
      );
    });
    out.push(`PRODUCT LINK\n${data.product_url}`);
    return out.join("\n---\n\n");
  };

  return (
    <div className="border border-zinc-800 bg-zinc-950" data-testid="ads-export-panel">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[10px] uppercase tracking-widest bg-[#FFD600] text-black px-2 py-0.5">
            Ready - Manual Launch
          </div>
          <div className="font-mono text-xs uppercase tracking-widest">Ads ready to launch</div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={adsManagerUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-[#1877F2] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard flex items-center gap-2"
            data-testid="open-ads-manager-btn"
          >
            <ExternalLink className="w-3 h-3" /> Open Meta Ads Manager
          </a>
          <button
            onClick={() => copy(bundleText(), () => flash("all"))}
            className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard flex items-center gap-2"
            data-testid="copy-all-btn"
          >
            {copiedKey === "all" ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedKey === "all" ? "Copied" : "Copy All"}
          </button>
        </div>
      </div>

      {/* Campaign */}
      <Section icon={<Megaphone className="w-4 h-4 text-[#FFD600]" />} title="Campaign">
        <KV k="Name" v={data.campaign.name} />
        <KV k="Objective" v={data.campaign.objective} />
      </Section>

      {/* Targeting */}
      <Section icon={<Target className="w-4 h-4 text-[#FF3333]" />} title="Targeting">
        <KV k="Locations" v={data.targeting.locations.join(", ")} />
        <KV k="Audience" v={`${data.targeting.type} (recommended)`} />
        <KV k="Optimization" v={data.targeting.optimization || "Conversions"} />
        <button
          onClick={() =>
            copy(
              `Locations: ${data.targeting.locations.join(", ")}\nAudience: ${data.targeting.type}\nOptimization: ${
                data.targeting.optimization || "Conversions"
              }`,
              () => flash("targeting")
            )
          }
          className="mt-3 font-mono text-[10px] uppercase tracking-widest border border-zinc-700 px-3 py-1.5 hover:bg-white hover:text-black transition-colors inline-flex items-center gap-2"
          data-testid="copy-targeting-btn"
        >
          {copiedKey === "targeting" ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copiedKey === "targeting" ? "Copied" : "Copy Targeting"}
        </button>
      </Section>

      {/* Creatives */}
      <Section icon={<Sparkles className="w-4 h-4 text-[#FFD600]" />} title={`Creatives (${data.creatives.length})`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {data.creatives.map((c, i) => (
            <div key={i} className="border border-zinc-800 bg-black p-4" data-testid={`ad-creative-${i}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Ad #{i + 1}</span>
                {c.recommended && (
                  <span className="font-mono text-[10px] uppercase tracking-widest bg-[#FF3333] text-white px-2 py-0.5 flex items-center gap-1">
                    <Flame className="w-3 h-3" /> Recommended
                  </span>
                )}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Headline</div>
              <div className="font-heading text-lg uppercase mb-3 leading-tight">{c.headline}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Primary text</div>
              <div className="text-zinc-300 text-sm mb-3 whitespace-pre-line">{c.primary_text}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Image</div>
              <div className="flex items-center gap-2 mb-3">
                <img src={c.image_url} alt="" className="w-16 h-10 object-cover border border-zinc-800" />
                <button
                  onClick={() => copy(c.image_url, () => flash(`img-${i}`))}
                  className="font-mono text-[10px] uppercase tracking-widest border border-zinc-700 px-2 py-1 hover:bg-white hover:text-black transition-colors"
                  data-testid={`copy-image-url-${i}`}
                >
                  {copiedKey === `img-${i}` ? "Copied" : "Copy URL"}
                </button>
              </div>
              <button
                onClick={() =>
                  copy(
                    `Headline:\n${c.headline}\n\nPrimary Text:\n${c.primary_text}\n\nImage: ${c.image_url}`,
                    () => flash(`ad-${i}`)
                  )
                }
                className="w-full bg-[#FFD600] text-black font-mono text-[10px] uppercase tracking-widest py-2 btn-hard flex items-center justify-center gap-2"
                data-testid={`copy-ad-${i}`}
              >
                {copiedKey === `ad-${i}` ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === `ad-${i}` ? "Copied" : "Copy This Ad"}
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* Product link */}
      <Section icon={<ExternalLink className="w-4 h-4 text-[#FF3333]" />} title="Product link">
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={data.product_url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-zinc-300 hover:text-[#FFD600] break-all"
            data-testid="product-url"
          >
            {data.product_url}
          </a>
          <button
            onClick={() => copy(data.product_url, () => flash("url"))}
            className="font-mono text-[10px] uppercase tracking-widest border border-zinc-700 px-3 py-1.5 hover:bg-white hover:text-black transition-colors inline-flex items-center gap-2"
            data-testid="copy-link-btn"
          >
            {copiedKey === "url" ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedKey === "url" ? "Copied" : "Copy Link"}
          </button>
        </div>
      </Section>

      {/* Instructions */}
      <Section title="Quick instructions" divider>
        <ol className="font-mono text-sm text-zinc-400 space-y-1">
          <li>
            <span className="text-[#FFD600]">1.</span> Click "Open Meta Ads Manager"
          </li>
          <li>
            <span className="text-[#FFD600]">2.</span> Create campaign -> Objective: <b className="text-white">Sales</b>
          </li>
          <li>
            <span className="text-[#FFD600]">3.</span> Paste creatives (we pre-picked the winner)
          </li>
          <li>
            <span className="text-[#FFD600]">4.</span> Set daily budget ($5-10) and launch
          </li>
        </ol>
        <div className="mt-4 border border-[#FFD600] bg-[#FFD600]/5 p-3 font-mono text-xs text-[#FFD600] uppercase tracking-widest">
          Post 3 videos today -> get first sale
        </div>
      </Section>
    </div>
  );
}

function Section({ icon, title, children, divider }) {
  return (
    <div className={`p-6 ${divider ? "border-t border-zinc-800" : "border-b border-zinc-800"}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
        {icon && <span>{icon}</span>} {title}
      </div>
      {children}
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="flex gap-4 py-1">
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 w-32 flex-shrink-0">{k}</div>
      <div className="text-zinc-200 text-sm">{v}</div>
    </div>
  );
}
