import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Gauge, Loader2, RefreshCw, Send, ShieldCheck, ShoppingCart, Target, Video, Zap } from "lucide-react";

function copy(text, done) {
  navigator.clipboard.writeText(text).then(() => done?.());
}

export default function MoneyPath() {
  const [products, setProducts] = useState([]);
  const [listings, setListings] = useState([]);
  const [exportsById, setExportsById] = useState({});
  const [analyticsById, setAnalyticsById] = useState({});
  const [reviewsById, setReviewsById] = useState({});
  const [trust, setTrust] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, l, t] = await Promise.all([api.get("/products"), api.get("/listings"), api.get("/trust/metrics")]);
      const productRows = p.data || [];
      setProducts(productRows);
      setListings(l.data.listings || []);
      setTrust(t.data);
      const pairs = await Promise.all(productRows.slice(0, 6).map(async (product) => {
        const [tt, an, rv] = await Promise.allSettled([
          api.get(`/tiktok/export/${product.id}`),
          api.get(`/analytics/${product.id}`),
          api.get(`/products/${product.id}/sellability`),
        ]);
        return [
          product.id,
          tt.status === "fulfilled" ? tt.value.data : null,
          an.status === "fulfilled" ? an.value.data : null,
          rv.status === "fulfilled" ? rv.value.data : null,
        ];
      }));
      setExportsById(Object.fromEntries(pairs.map(([id, tt]) => [id, tt])));
      setAnalyticsById(Object.fromEntries(pairs.map(([id, , an]) => [id, an])));
      setReviewsById(Object.fromEntries(pairs.map(([id, , , rv]) => [id, rv])));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const liveListings = listings.filter((l) => l.status === "LIVE" && l.real);
  const active = useMemo(() => {
    const ranked = [...products].sort((a, b) => {
      const ar = reviewsById[a.id]?.sellability_score || 0;
      const br = reviewsById[b.id]?.sellability_score || 0;
      const al = liveListings.some((l) => l.product_id === a.id) ? 10 : 0;
      const bl = liveListings.some((l) => l.product_id === b.id) ? 10 : 0;
      const arev = analyticsById[a.id]?.totals?.revenue || 0;
      const brev = analyticsById[b.id]?.totals?.revenue || 0;
      return (br + bl + brev) - (ar + al + arev);
    });
    return ranked[0] || null;
  }, [products, liveListings, reviewsById, analyticsById]);
  const listing = liveListings.find((l) => l.product_id === active?.id);
  const tiktok = exportsById[active?.id] || {};
  const posts = tiktok.posts || [];
  const analytics = analyticsById[active?.id]?.totals || {};
  const review = reviewsById[active?.id] || {};
  const firstPost = posts[0];
  const moneyLink = firstPost?.tracking_url || listing?.listing_url || "";
  const postText = firstPost ? [
    firstPost.hook,
    "",
    firstPost.script,
    "",
    firstPost.caption,
    "",
    moneyLink,
    "",
    (firstPost.hashtags || []).map((h) => `#${h}`).join(" "),
  ].join("\n") : "";

  return (
    <div className="p-8 lg:p-12" data-testid="money-path-page">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600]">Revenue path</div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-5xl uppercase lg:text-6xl">Make money next</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">One offer, one link, one post, one follow-up. This page removes the digging.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
        </button>
      </div>

      <TrustStrip trust={trust} />

      {!active ? (
        <section className="border border-[#FFD600] bg-[#FFD600]/10 p-8">
          <div className="font-heading text-4xl uppercase">Create your first product</div>
          <p className="mt-2 max-w-xl text-zinc-300">Money path starts after one product exists.</p>
          <Link to="/app/products" className="btn-hard mt-5 inline-flex bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black">Build product</Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="bg-zinc-950 p-6">
            <div className="mb-6 border border-[#FFD600] bg-[#FFD600]/10 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
                    <Target className="h-3 w-3" /> First sale command center
                  </div>
                  <div className="font-heading text-3xl uppercase">{review.exact_next_action || "Pick one product and post one asset today."}</div>
                </div>
                <div className="border border-[#FFD600] bg-black px-4 py-3 text-center">
                  <div className="font-heading text-4xl uppercase text-[#FFD600]">{review.sellability_score || active.completeness_score || 0}</div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">Sellability</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <CommandCell icon={<Video />} label="Post" value={review.best_first_hook || firstPost?.hook || "Create TikTok posts first"} />
                <CommandCell icon={<ExternalLink />} label="Send traffic" value={moneyLink ? "Use the tracked money link below" : "Publish a real listing first"} />
                <CommandCell icon={<Gauge />} label="Watch" value={(analytics.sales || 0) > 0 ? "Scale winners only" : (analytics.clicks || 0) > 0 ? "Click to sale conversion" : "First real click"} />
              </div>
              {review.priority_fix?.what && (
                <div className="mt-4 flex items-start gap-3 border border-zinc-800 bg-black p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF3333]" />
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#FF3333]">Blocker</div>
                    <div className="text-sm text-zinc-300">{review.priority_fix.what}: {review.priority_fix.why}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Primary offer</div>
            <h2 className="font-heading text-4xl uppercase">{active.title}</h2>
            <p className="mt-2 max-w-2xl text-zinc-400">{active.tagline}</p>

            <div className="mt-6 grid grid-cols-3 gap-px bg-zinc-800">
              <Metric icon={<Zap />} label="Clicks" value={analytics.clicks || 0} />
              <Metric icon={<ShoppingCart />} label="Sales" value={analytics.sales || 0} />
              <Metric icon={<CheckCircle2 />} label="Revenue" value={`$${analytics.revenue || 0}`} />
            </div>

            <div className="mt-6 border border-[#FFD600] bg-[#FFD600]/10 p-5">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Step 1: use this money link</div>
              {moneyLink ? (
                <div className="flex flex-wrap gap-2">
                  <input readOnly value={moneyLink} className="min-w-0 flex-1 border border-zinc-800 bg-black px-3 py-3 font-mono text-xs text-zinc-200" />
                  <button
                    onClick={() => copy(moneyLink, () => setCopied("money-link"))}
                    className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-4 py-3 font-mono text-xs uppercase tracking-widest text-black"
                  >
                    <Copy className="h-3 w-3" /> {copied === "money-link" ? "Copied" : "Copy"}
                  </button>
                  <a href={moneyLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                </div>
              ) : (
                <Link to={`/app/products/${active.id}`} className="btn-hard inline-flex bg-[#FF3333] px-5 py-3 font-mono text-xs uppercase tracking-widest text-white">Publish listing</Link>
              )}
            </div>

            <div className="mt-6 border border-zinc-800 bg-black p-5">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Step 2: post this today</div>
              {firstPost ? (
                <>
                  <div className="mb-3 font-heading text-3xl uppercase">{firstPost.hook}</div>
                  <pre className="mb-4 whitespace-pre-wrap border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">{postText}</pre>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => copy(postText, () => setCopied("post"))} className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-4 py-3 font-mono text-xs uppercase tracking-widest text-black">
                      <Copy className="h-3 w-3" /> {copied === "post" ? "Copied" : "Copy post"}
                    </button>
                    <a href="https://www.tiktok.com/upload" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
                      <Video className="h-3 w-3" /> Upload TikTok
                    </a>
                  </div>
                </>
              ) : (
                <Link to={`/app/products/${active.id}#traffic-engine`} className="btn-hard inline-flex bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black">Create posts</Link>
              )}
            </div>
          </section>

          <aside className="bg-zinc-950 p-6">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Step 3: send direct outreach</div>
            <CopyBlock
              id="dm"
              copied={copied}
              setCopied={setCopied}
              title="DM script"
              text={`Hey, I just launched ${active.title}.\n\nIt's built for ${active.target_audience || "creators"} who want a faster path without guessing.\n\nWant me to send it over?`}
            />
            <CopyBlock
              id="reply"
              copied={copied}
              setCopied={setCopied}
              title="If they say yes"
              text={`Here it is:\n${moneyLink || listing?.listing_url || ""}\n\nStart with the first section and use it today. Would love your honest take.`}
            />
            <CopyBlock
              id="email"
              copied={copied}
              setCopied={setCopied}
              title="Quick email"
              text={`Subject: ${active.title} is live\n\nI just launched ${active.title}.\n\n${active.description || active.tagline}\n\nGrab it here:\n${moneyLink || listing?.listing_url || ""}`}
            />
            <div className="mt-5 border border-zinc-800 bg-black p-4">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
                <Send className="h-3 w-3" /> Today target
              </div>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li>Post 3 TikToks.</li>
                <li>DM 10 people.</li>
                <li>Send 1 email.</li>
                <li>Refresh this page and watch clicks.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="bg-black p-4">
      <div className="mb-2 text-[#FFD600]">{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-heading text-3xl uppercase">{value}</div>
    </div>
  );
}

function TrustStrip({ trust }) {
  const t = trust || {};
  return (
    <section className="mb-8 border border-zinc-800 bg-zinc-950 p-5" data-testid="trust-layer">
      <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">
        <ShieldCheck className="h-3 w-3" /> Real proof only
      </div>
      <div className="grid grid-cols-2 gap-px bg-zinc-800 md:grid-cols-5">
        <TrustMetric label="Products" value={t.products_created || 0} />
        <TrustMetric label="Unlocked" value={t.products_unlocked || 0} />
        <TrustMetric label="Live listings" value={t.live_store_listings || 0} />
        <TrustMetric label="Clicks" value={t.clicks_tracked || 0} />
        <TrustMetric label="Sales" value={t.sales_tracked || 0} />
      </div>
      <div className="mt-3 text-xs text-zinc-500">{t.disclaimer || "No simulated analytics. No income guarantee."}</div>
    </section>
  );
}

function TrustMetric({ label, value }) {
  return (
    <div className="bg-black p-4">
      <div className="font-heading text-3xl uppercase text-[#FFD600]">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
    </div>
  );
}

function CommandCell({ icon, label, value }) {
  return (
    <div className="border border-zinc-800 bg-black p-4">
      <div className="mb-2 text-[#FFD600]">{icon}</div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-200">{value}</div>
    </div>
  );
}

function CopyBlock({ id, title, text, copied, setCopied }) {
  return (
    <div className="mb-4 border border-zinc-800 bg-black p-4">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">{title}</div>
      <pre className="mb-3 whitespace-pre-wrap text-sm text-zinc-300">{text}</pre>
      <button onClick={() => copy(text, () => setCopied(id))} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
        <Copy className="h-3 w-3" /> {copied === id ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
