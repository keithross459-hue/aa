import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";
import { INCOME_STRATEGY, LIVE_PRODUCT_LINKS } from "../lib/incomeStrategy";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  MousePointerClick,
  RefreshCw,
  Send,
  ShoppingCart,
  Target,
  TrendingUp,
} from "lucide-react";

function copyText(text, onDone) {
  navigator.clipboard.writeText(text).then(onDone).catch(() => {});
}

export default function Dashboard() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [listings, setListings] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [posts, setPosts] = useState([]);
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [productRes, listingRes] = await Promise.all([
        api.get("/products"),
        api.get("/listings"),
      ]);
      const productRows = productRes.data || [];
      const listingRows = listingRes.data.listings || [];
      setProducts(productRows);
      setListings(listingRows);

      const best = productRows.find((p) => p.id === INCOME_STRATEGY.productId) || productRows[0];
      if (best) {
        const [analyticsRes, postRes] = await Promise.allSettled([
          api.get(`/analytics/${best.id}`),
          api.get(`/tiktok/export/${best.id}`),
        ]);
        setAnalytics(analyticsRes.status === "fulfilled" ? analyticsRes.value.data.totals || {} : {});
        setPosts(postRes.status === "fulfilled" ? postRes.value.data.posts || [] : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const bestProduct = useMemo(() => {
    return products.find((p) => p.id === INCOME_STRATEGY.productId) || products[0] || null;
  }, [products]);

  const liveListing = useMemo(() => {
    if (!bestProduct) return null;
    return listings.find((l) => l.product_id === bestProduct.id && l.status === "LIVE" && l.real);
  }, [bestProduct, listings]);

  const moneyUrl = liveListing?.listing_url || (bestProduct && LIVE_PRODUCT_LINKS[bestProduct.id]) || INCOME_STRATEGY.url;
  const firstPost = posts[0];
  const dm = `Hey, quick one. I made a simple follow-up script kit for local service businesses that lose leads after missed calls or slow quote follow-up.\n\nIt is $${INCOME_STRATEGY.price} and built to copy/paste into SMS, email, and review requests.\n\nWant the link?`;
  const postText = firstPost
    ? [firstPost.hook, "", firstPost.script, "", firstPost.caption, "", moneyUrl, "", (firstPost.hashtags || []).map((h) => `#${h}`).join(" ")].join("\n")
    : `Most local service businesses do not need more leads first. They need faster follow-up.\n\nUse this $${INCOME_STRATEGY.price} script kit to respond to missed calls, follow up on quotes, and ask for reviews.\n\n${moneyUrl}`;

  return (
    <div className="p-6 lg:p-10" data-testid="dashboard-page">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">
            Income command center
          </div>
          <h1 className="font-heading text-5xl uppercase leading-none lg:text-6xl">Sell one clear offer first</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            The app now points at the fastest path: one understandable product, one live link, one daily promotion loop.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <section className="mb-8 border border-[#FFD600] bg-[#FFD600]/10 p-6 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">
              <Target className="h-4 w-4" /> Best income possibility
            </div>
            <h2 className="font-heading text-4xl uppercase lg:text-5xl">{INCOME_STRATEGY.headline}</h2>
            <p className="mt-3 max-w-3xl text-zinc-300">{INCOME_STRATEGY.reason}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={moneyUrl} target="_blank" rel="noreferrer" className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black">
                Open live offer <ExternalLink className="h-4 w-4" />
              </a>
              {bestProduct && (
                <Link to={`/app/products/${bestProduct.id}`} className="inline-flex items-center gap-2 border border-zinc-700 px-5 py-3 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
                  Edit product <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link to="/app/acquire" className="inline-flex items-center gap-2 border border-zinc-700 px-5 py-3 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
                Generate client scripts <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px bg-zinc-800">
            <Metric icon={<ShoppingCart />} label="Price" value={`$${INCOME_STRATEGY.price}`} />
            <Metric icon={<MousePointerClick />} label="Clicks" value={analytics.clicks || 0} />
            <Metric icon={<TrendingUp />} label="Sales" value={analytics.sales || 0} />
          </div>
        </div>
      </section>

      <div className="grid gap-px border border-zinc-800 bg-zinc-800 xl:grid-cols-[1fr_0.9fr]">
        <section className="bg-zinc-950 p-6">
          <div className="mb-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Today&apos;s revenue loop</div>
          <div className="grid gap-3 md:grid-cols-3">
            {INCOME_STRATEGY.dailyPlan.map((step, index) => (
              <div key={step} className="border border-zinc-800 bg-black p-4">
                <div className="mb-3 inline-flex h-7 w-7 items-center justify-center bg-[#FFD600] font-mono text-xs text-black">
                  {index + 1}
                </div>
                <div className="text-sm text-zinc-200">{step}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 border border-zinc-800 bg-black p-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Copy this post</div>
            <pre className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{postText}</pre>
            <button onClick={() => copyText(postText, () => setCopied("post"))} className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-4 py-3 font-mono text-xs uppercase tracking-widest text-black">
              <Copy className="h-3 w-3" /> {copied === "post" ? "Copied" : "Copy post"}
            </button>
          </div>
        </section>

        <aside className="bg-zinc-950 p-6">
          <div className="mb-5 font-mono text-xs uppercase tracking-widest text-zinc-500">Direct outreach</div>
          <div className="border border-zinc-800 bg-black p-5">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
              <Send className="h-3 w-3" /> DM script
            </div>
            <pre className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{dm}</pre>
            <button onClick={() => copyText(dm, () => setCopied("dm"))} className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
              <Copy className="h-3 w-3" /> {copied === "dm" ? "Copied" : "Copy DM"}
            </button>
          </div>

          <div className="mt-5 border border-zinc-800 bg-black p-5">
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
              <CheckCircle2 className="h-3 w-3" /> What this app is for now
            </div>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li>Find a simple product a buyer already understands.</li>
              <li>Publish it to a real checkout page.</li>
              <li>Post and DM until clicks or sales show signal.</li>
              <li>Improve the product from real buyer objections.</li>
            </ul>
          </div>
        </aside>
      </div>
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
