import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  ExternalLink,
  Flame,
  Loader2,
  Lock,
  MousePointerClick,
  RefreshCw,
  Send,
  Share2,
  Signal,
  ShoppingCart,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useAuth } from "../auth";
import ScaleUpgradePrompt from "./ScaleUpgradePrompt";

function copy(text, onDone) {
  navigator.clipboard.writeText(text).then(() => onDone?.());
}

function msUntilWindowEnds(launchedAt) {
  if (!launchedAt) return 0;
  const end = new Date(launchedAt).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(0, end - Date.now());
}

function formatCountdown(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function FirstResultEngine({ productId, launched }) {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [err, setErr] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [signalCheck, setSignalCheck] = useState(null);
  const [referral, setReferral] = useState(null);
  const [includeWatermark, setIncludeWatermark] = useState(true);

  const load = useCallback(async () => {
    if (!launched) return;
    try {
      const r = await api.get(`/first-result/${productId}`);
      setData(r.data);
      setRemaining(msUntilWindowEnds(r.data.launched_at));
      setErr("");
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "First Result Mode failed to load");
    } finally {
      setLoading(false);
    }
  }, [launched, productId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!launched) return;
    api.get("/referrals/me").then((r) => setReferral(r.data)).catch(() => setReferral(null));
  }, [launched]);

  useEffect(() => {
    const t = setInterval(() => setRemaining(msUntilWindowEnds(data?.launched_at)), 1000);
    return () => clearInterval(t);
  }, [data?.launched_at]);

  const record = async (action, contentId) => {
    setBusyKey(`${action}-${contentId || "all"}`);
    try {
      await api.post(`/first-result/${productId}/event`, { action, content_id: contentId });
      await load();
    } finally {
      setBusyKey("");
    }
  };

  const startSignalCheck = async (action, contentId, label) => {
    const baselineClicks = data?.totals?.clicks || 0;
    const baselineSales = data?.totals?.sales || 0;
    setSignalCheck({
      status: "checking",
      action,
      contentId,
      label,
      baselineClicks,
      baselineSales,
      message: "Checking for activity...",
    });
    window.setTimeout(async () => {
      try {
        const r = await api.get(`/first-result/${productId}`);
        setData(r.data);
        const clicks = r.data?.totals?.clicks || 0;
        const sales = r.data?.totals?.sales || 0;
        if (sales > baselineSales) {
          setSignalCheck({
            status: "success",
            action,
            contentId,
            label,
            message: "Sale detected from your promotion.",
          });
        } else if (clicks > baselineClicks || clicks > 0) {
          setSignalCheck({
            status: "success",
            action,
            contentId,
            label,
            message: action === "copy_link" ? "Someone viewed your product. Link clicks detected from your promotion." : "Someone viewed your product. Your TikTok post is driving traffic.",
          });
        } else {
          setSignalCheck({
            status: "quiet",
            action,
            contentId,
            label,
            message: "No traffic yet - try another post.",
          });
        }
      } catch {
        setSignalCheck({
          status: "quiet",
          action,
          contentId,
          label,
          message: "No traffic yet - try another post.",
        });
      }
    }, 45000);
  };

  const state = useMemo(() => {
    const milestones = data?.milestones || {};
    const totals = data?.totals || {};
    if (milestones.first_sale) return { tone: "sale", message: "You just made your first sale" };
    if (milestones.first_click) return { tone: "click", message: "You got your first click - momentum started" };
    if (milestones.first_post || milestones.product_link_shared) return { tone: "action", message: "You're ahead of most users - keep going" };
    if ((totals.clicks || 0) > 0) return { tone: "click", message: "You got your first click - momentum started" };
    return { tone: "warning", message: "No promotion detected yet - most products don't get traffic without this" };
  }, [data]);

  if (!launched) return null;

  if (loading && !data) {
    return (
      <section className="mb-10 border border-[#FFD600] bg-[#FFD600]/5 p-8">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-[#FFD600]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Launch Momentum
        </div>
      </section>
    );
  }

  if (err) {
    return <section className="mb-10 border border-[#FF3333] bg-[#FF3333]/10 p-6 font-mono text-xs uppercase tracking-widest text-[#FF3333]">{String(err)}</section>;
  }

  const posts = data?.posts || [];
  const post = posts[0];
  const contentId = post?.content_id || "tiktok_post_1";
  const milestones = data?.milestones || {};
  const totals = data?.totals || {};
  const watermark = includeWatermark ? "\n\nBuilt with FiiLTHY.AI" : "";
  const postText = post
    ? [
        `HOOK: ${post.hook}`,
        "",
        post.script,
        "",
        `CAPTION: ${post.caption}${watermark}`,
        "",
        `CTA: ${post.tracking_url || data.product_url || ""}`,
        "",
        (post.hashtags || []).map((h) => `#${h}`).join(" "),
      ].join("\n")
    : "";
  const currentStep = milestones.first_post ? (milestones.product_link_shared ? 3 : 2) : 1;
  const hasTraction = (totals.clicks || 0) > 0 || (totals.sales || 0) > 0;
  const successLevel = (totals.sales || 0) > 0 ? "sale" : hasTraction ? "click" : "";
  const confidenceCopy = hasTraction && !(totals.sales > 0)
    ? "Good sign - traffic is coming in. Keep pushing."
    : hasTraction
      ? "Proof is building. Turn this signal into another promotion."
      : "Traffic starts with action - post again to get visibility.";

  return (
    <section className="mb-10 border border-[#FFD600] bg-[#FFD600]/5" data-testid="first-result-engine">
      <div className="border-b border-[#FFD600]/40 bg-black p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">
            <Zap className="h-4 w-4" /> Your product is in its launch window
          </div>
          <div className="flex items-center gap-2 border border-[#FFD600] bg-[#FFD600] px-3 py-2 font-mono text-xs uppercase tracking-widest text-black">
            <Clock3 className="h-3 w-3" /> {formatCountdown(remaining)}
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-5xl uppercase">Let&apos;s get your first click</h2>
            <p className="mt-2 max-w-3xl text-zinc-300">Products perform best when promoted immediately. Take action now, then watch the tracker move.</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      <div className={`border-b border-zinc-800 px-6 py-3 font-mono text-xs uppercase tracking-widest ${state.tone === "warning" ? "bg-[#FF3333]/10 text-[#FF3333]" : "bg-[#FFD600]/10 text-[#FFD600]"}`}>
        {state.message}
      </div>

      <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
              <Signal className="h-3 w-3" /> Signal check
            </div>
            <div className="text-sm text-zinc-300">
              {signalCheck ? signalCheck.message : "Take an action and we will check whether activity starts moving."}
            </div>
            {signalCheck?.label && (
              <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Action: {signalCheck.label}
              </div>
            )}
          </div>
          {signalCheck?.status === "checking" && (
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#FFD600]">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-zinc-800 md:grid-cols-5">
        <ProgressItem done label="Product launched" />
        <ProgressItem done={milestones.first_post || milestones.first_engagement} label="First promotion" />
        <ProgressItem done={milestones.first_click} label="First click" />
        <ProgressItem done={milestones.first_visitor} label="First visitor" />
        <ProgressItem done={milestones.first_sale} label="First sale" />
      </div>

      <div className="grid grid-cols-1 gap-px bg-zinc-800 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="bg-zinc-950 p-6">
          <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Action sequence</div>
          <div className="space-y-3">
            <ActionStep
              n="1"
              title="Post your first TikTok"
              active={currentStep === 1}
              done={milestones.first_post}
              locked={false}
            >
              {post ? (
                <div>
                  <div className="mb-3 border border-zinc-800 bg-black p-4">
                    <div className="mb-2 font-heading text-2xl uppercase leading-tight">{post.hook}</div>
                    <p className="text-sm text-zinc-300">{post.caption}{includeWatermark ? " Built with FiiLTHY.AI" : ""}</p>
                  </div>
                  <label className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    <input type="checkbox" checked={includeWatermark} onChange={(e) => setIncludeWatermark(e.target.checked)} />
                    Add subtle "Built with FiiLTHY.AI"
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        copy(postText, () => setCopiedKey(contentId));
                        record("copy_post", contentId);
                        startSignalCheck("copy_post", contentId, "Copied TikTok post");
                      }}
                      className="btn-hard flex items-center gap-2 bg-[#FFD600] px-4 py-2 font-mono text-xs uppercase tracking-widest text-black"
                      data-testid="momentum-copy-post"
                    >
                      {copiedKey === contentId ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedKey === contentId ? "Copied" : "Copy post"}
                    </button>
                    <a
                      href="https://www.tiktok.com/upload"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black"
                    >
                      <ExternalLink className="h-3 w-3" /> Open TikTok
                    </a>
                    <button
                      onClick={() => {
                        record("marked_posted", contentId);
                        startSignalCheck("marked_posted", contentId, "Posted first TikTok");
                      }}
                      disabled={busyKey === `marked_posted-${contentId}`}
                      className="flex items-center gap-2 border border-[#FFD600] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[#FFD600] hover:bg-[#FFD600] hover:text-black disabled:opacity-60"
                      data-testid="momentum-posted"
                    >
                      {busyKey === `marked_posted-${contentId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      I posted it
                    </button>
                  </div>
                </div>
              ) : (
                <a href="#traffic-engine" className="inline-flex items-center gap-2 bg-[#FF3333] px-5 py-3 font-mono text-xs uppercase tracking-widest text-white btn-hard btn-hard-red">
                  Open traffic engine
                </a>
              )}
            </ActionStep>

            <ActionStep n="2" title="Send your product link to 3 people" active={currentStep === 2} done={milestones.product_link_shared} locked={!milestones.first_post}>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    copy(data.product_url || "", () => setCopiedKey("product-link"));
                    record("copy_link", "product_link");
                    startSignalCheck("copy_link", "product_link", "Shared product link");
                  }}
                  disabled={!data.product_url}
                  className="btn-hard flex items-center gap-2 bg-[#FFD600] px-4 py-2 font-mono text-xs uppercase tracking-widest text-black disabled:opacity-60"
                  data-testid="momentum-copy-link"
                >
                  {copiedKey === "product-link" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedKey === "product-link" ? "Copied" : "Copy link"}
                </button>
              </div>
            </ActionStep>

            <ActionStep n="3" title="Check your traffic" active={currentStep === 3} done={milestones.first_click || milestones.first_sale} locked={!milestones.product_link_shared}>
              <a href="#analytics-panel" className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
                <BarChart3 className="h-3 w-3" /> View dashboard
              </a>
            </ActionStep>
          </div>
        </div>

        <aside className="bg-zinc-950 p-6">
          <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Live progress</div>
          <div className="mb-4 border border-zinc-800 bg-black p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
              <Eye className="h-3 w-3" /> Proof layer
            </div>
            <p className="text-sm text-zinc-300">{confidenceCopy}</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-zinc-800">
            <Metric icon={<MousePointerClick />} label="Clicks" value={totals.clicks || 0} />
            <Metric icon={<Users />} label="Visitors" value={totals.clicks || 0} />
            <Metric icon={<ShoppingCart />} label="Sales" value={totals.sales || 0} />
            <Metric icon={<Sparkles />} label="Revenue" value={`$${totals.revenue || 0}`} />
          </div>

          {hasTraction && (
            <div className="mt-5 border border-[#FFD600] bg-[#FFD600]/10 p-4" data-testid="winner-momentum-extension">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
                <Flame className="h-3 w-3" /> This product is gaining traction
              </div>
              <div className="space-y-2">
                <Link to={`/app/products?remix=${productId}`} className="block border border-zinc-700 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">Remix this product</Link>
                <Link to={`/app/products?remix=${productId}&batch=5`} className="block bg-[#FFD600] px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-black">Launch 5 similar products</Link>
                <a href="#traffic-engine" className="block border border-zinc-700 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">Create more content like this</a>
              </div>
            </div>
          )}

          {successLevel && (
            <SuccessShareCard
              productTitle={data.product_title}
              clicks={totals.clicks || 0}
              sales={totals.sales || 0}
              revenue={totals.revenue || 0}
              referralUrl={referral?.share_url}
              level={successLevel}
            />
          )}

          {hasTraction && <ScaleUpgradePrompt trigger={successLevel === "sale" ? "winner" : "traction"} compact className="mt-5" />}

          {hasTraction && (
            <div className="mt-5 border border-zinc-800 bg-black p-4" data-testid="referral-momentum-card">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Want to scale this faster?</div>
              <p className="mb-3 text-sm text-zinc-300">Invite a builder. More people using your link means more loops, more tests, and more chances to spot winners.</p>
              <div className="flex flex-wrap gap-2">
                {referral?.share_url && (
                  <button
                    onClick={() => copy(referral.share_url, () => setCopiedKey("referral-link"))}
                    className="flex items-center gap-2 bg-[#FFD600] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-black"
                  >
                    {copiedKey === "referral-link" ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedKey === "referral-link" ? "Copied" : "Copy invite"}
                  </button>
                )}
                <Link to="/app/referrals" onClick={refresh} className="border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
                  Invite system
                </Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function SuccessShareCard({ productTitle, clicks, sales, revenue, referralUrl, level }) {
  const [copied, setCopied] = useState(false);
  const headline = level === "sale" ? "You're getting sales - share this" : "You're getting results - share this";
  const caption = level === "sale"
    ? `First sale landed for ${productTitle}. Built, launched, and promoted with FiiLTHY.AI.`
    : `${clicks} people checked out ${productTitle}. Launch momentum is real. Built with FiiLTHY.AI.`;
  const text = [
    headline,
    "",
    productTitle,
    clicks ? `${clicks} link clicks` : "",
    sales ? `${sales} sales` : "",
    revenue ? `$${revenue} revenue` : "",
    "",
    caption,
    referralUrl || "",
  ].filter(Boolean).join("\n");

  return (
    <div className="mt-5 border border-zinc-700 bg-black p-4" data-testid="success-share-card">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
        <Share2 className="h-3 w-3" /> {headline}
      </div>
      <div className="mb-3 border border-zinc-800 bg-zinc-950 p-4">
        <div className="font-heading text-3xl uppercase">{productTitle}</div>
        <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300">
          <span>{clicks} clicks</span>
          <span>{sales} sales</span>
          <span>${revenue} revenue</span>
        </div>
        <div className="mt-3 text-xs text-zinc-500">Built with FiiLTHY.AI</div>
      </div>
      <p className="mb-3 text-sm text-zinc-300">{caption}</p>
      <button
        onClick={() => copy(text, () => setCopied(true))}
        className="btn-hard flex items-center gap-2 bg-[#FFD600] px-4 py-2 font-mono text-xs uppercase tracking-widest text-black"
      >
        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy share"}
      </button>
      {referralUrl && <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Invite link included</div>}
    </div>
  );
}

function ProgressItem({ done, label }) {
  return (
    <div className="bg-zinc-950 p-4">
      <div className={`mb-2 flex h-7 w-7 items-center justify-center border ${done ? "border-[#FFD600] bg-[#FFD600] text-black" : "border-zinc-700 text-zinc-500"}`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : null}
      </div>
      <div className={`font-mono text-[10px] uppercase tracking-widest ${done ? "text-zinc-100" : "text-zinc-500"}`}>{label}</div>
    </div>
  );
}

function ActionStep({ n, title, active, done, locked, children }) {
  return (
    <div className={`border p-4 ${active ? "border-[#FFD600] bg-[#FFD600]/5" : done ? "border-zinc-700 bg-black" : "border-zinc-800 bg-black/70"} ${locked ? "opacity-55" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-7 w-7 items-center justify-center font-mono text-xs ${done ? "bg-[#FFD600] text-black" : active ? "border border-[#FFD600] text-[#FFD600]" : "border border-zinc-700 text-zinc-500"}`}>
            {done ? <CheckCircle2 className="h-4 w-4" /> : n}
          </span>
          <div className="font-heading text-2xl uppercase">{title}</div>
        </div>
        {locked && <Lock className="h-4 w-4 text-zinc-500" />}
      </div>
      {!locked && children}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="bg-black p-4">
      <div className="mb-2 text-[#FFD600]">{icon}</div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-heading text-3xl uppercase">{value}</div>
    </div>
  );
}
