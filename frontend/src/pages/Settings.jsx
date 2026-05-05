import { useEffect, useState } from "react";
import api from "../api";
import { Loader2, CheckCircle2, XCircle, Save, Trash2, Zap, ExternalLink, UploadCloud, Send } from "lucide-react";

const PROVIDER_META = {
  gumroad: {
    name: "Gumroad",
    tagline: "Real digital product publishing.",
    help: "Get your access token at https://gumroad.com/settings/advanced",
    helpUrl: "https://gumroad.com/settings/advanced",
    fieldLabels: { access_token: "Access Token" },
  },
  stripe: {
    name: "Stripe",
    tagline: "Collect your own subscription + checkout revenue.",
    help: "Use your Stripe live or test secret key from https://dashboard.stripe.com/apikeys",
    helpUrl: "https://dashboard.stripe.com/apikeys",
    fieldLabels: { secret_key: "Secret Key (sk_...)" },
  },
  meta: {
    name: "Meta (Facebook/Instagram) Ads",
    tagline: "Auto-launch paid campaigns to your own ad account.",
    help: "Create a long-lived user access token with ads_management scope at https://developers.facebook.com",
    helpUrl: "https://developers.facebook.com/tools/explorer/",
    fieldLabels: {
      access_token: "Access Token",
      ad_account_id: "Ad Account ID (without act_)",
      pixel_id: "Pixel ID",
      page_id: "Facebook Page ID",
    },
  },
  tiktok: {
    name: "TikTok",
    tagline: "Publish the daily viral content pack.",
    help: "Get a long-lived access token from TikTok for Developers (tiktok.com/v2/auth/authorize/)",
    helpUrl: "https://developers.tiktok.com/",
    fieldLabels: {
      access_token: "Access Token",
      advertiser_id: "Advertiser ID (optional)",
    },
  },
  openai: {
    name: "OpenAI",
    tagline: "Use your own OpenAI key for generations (optional - platform key is default).",
    help: "Get a key at https://platform.openai.com/api-keys",
    helpUrl: "https://platform.openai.com/api-keys",
    fieldLabels: { api_key: "API Key (sk-...)" },
  },
  anthropic: {
    name: "Anthropic (Claude)",
    tagline: "Use your own Claude key (optional).",
    help: "Get a key at https://console.anthropic.com/settings/keys",
    helpUrl: "https://console.anthropic.com/settings/keys",
    fieldLabels: { api_key: "API Key" },
  },
  stan_store: {
    name: "Stan Store",
    tagline: "Publish digital drops to your Stan link-in-bio.",
    help: "Creator API tokens live at https://stan.store/dashboard/integrations",
    helpUrl: "https://stan.store/dashboard/integrations",
    fieldLabels: { access_token: "Access Token" },
  },
  whop: {
    name: "Whop",
    tagline: "Launch paid access products on Whop.",
    help: "Get a company API key at https://dash.whop.com/settings/developer",
    helpUrl: "https://dash.whop.com/settings/developer",
    fieldLabels: { api_key: "API Key" },
  },
  payhip: {
    name: "Payhip",
    tagline: "Instant digital product storefront.",
    help: "Payhip API keys live at https://payhip.com/account/api",
    helpUrl: "https://payhip.com/account/api",
    fieldLabels: { api_key: "API Key" },
  },
  shopify: {
    name: "Shopify",
    tagline: "Push digital products to your Shopify store.",
    help: "Create a custom app and copy the admin API access token from your Shopify admin.",
    helpUrl: "https://help.shopify.com/en/manual/apps/app-types/custom-apps",
    fieldLabels: {
      store_domain: "Store domain (yourshop.myshopify.com)",
      admin_api_token: "Admin API access token",
    },
  },
  instagram: {
    name: "Instagram",
    tagline: "Cross-post your viral TikTok content.",
    help: "Connect via Meta Business Suite, then copy the long-lived page token + IG user id.",
    helpUrl: "https://developers.facebook.com/docs/instagram-api/",
    fieldLabels: {
      access_token: "Access Token",
      user_id: "Instagram User ID",
    },
  },
  twitter: {
    name: "Twitter / X",
    tagline: "Auto-post product drop threads.",
    help: "Generate a bearer token at https://developer.twitter.com/en/portal/dashboard",
    helpUrl: "https://developer.twitter.com/en/portal/dashboard",
    fieldLabels: { bearer_token: "Bearer Token" },
  },
  youtube: {
    name: "YouTube",
    tagline: "Upload Shorts auto-generated from your product.",
    help: "Use Google OAuth to get an access token with youtube.upload scope.",
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    fieldLabels: {
      access_token: "Access Token",
      channel_id: "Channel ID",
    },
  },
};

const ORDER = [
  ["Stores", ["gumroad", "stan_store", "whop", "payhip", "shopify"]],
  ["Payments", ["stripe"]],
  ["Ads & Social", ["meta", "tiktok", "instagram", "twitter", "youtube"]],
  ["AI (optional)", ["openai", "anthropic"]],
];

export default function Settings() {
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState({});
  const [testResult, setTestResult] = useState({});
  const [savedMsg, setSavedMsg] = useState("");
  const [tiktokStatus, setTiktokStatus] = useState(null);
  const [tiktokPosts, setTiktokPosts] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [videoCaption, setVideoCaption] = useState("");
  const [videoHashtags, setVideoHashtags] = useState("");
  const [videoScheduleAt, setVideoScheduleAt] = useState("");
  const [videoMode, setVideoMode] = useState("direct");

  const load = async () => {
    const r = await api.get("/settings");
    setData(r.data);
    api.get("/auth/tiktok/status").then((x) => setTiktokStatus(x.data)).catch(() => setTiktokStatus(null));
    api.get("/post/tiktok").then((x) => setTiktokPosts(x.data.posts || [])).catch(() => setTiktokPosts([]));
  };
  useEffect(() => { load(); }, []);

  const onChange = (provider, field, value) => {
    setEdits((p) => ({ ...p, [provider]: { ...(p[provider] || {}), [field]: value } }));
  };

  const save = async (provider) => {
    const payload = { providers: { [provider]: edits[provider] || {} } };
    setBusy((b) => ({ ...b, [provider]: true }));
    try {
      const r = await api.put("/settings", payload);
      setData(r.data);
      setEdits((e) => ({ ...e, [provider]: {} }));
      setSavedMsg(`${PROVIDER_META[provider].name} saved.`);
      setTimeout(() => setSavedMsg(""), 2500);
    } finally {
      setBusy((b) => ({ ...b, [provider]: false }));
    }
  };

  const test = async (provider) => {
    setBusy((b) => ({ ...b, [`${provider}_test`]: true }));
    setTestResult((t) => ({ ...t, [provider]: null }));
    try {
      const r = await api.post(`/settings/test/${provider}`);
      setTestResult((t) => ({ ...t, [provider]: r.data }));
    } catch (ex) {
      setTestResult((t) => ({ ...t, [provider]: { ok: false, error: String(ex) } }));
    } finally {
      setBusy((b) => ({ ...b, [`${provider}_test`]: false }));
    }
  };

  const clearProvider = async (provider) => {
    if (!window.confirm(`Clear your ${PROVIDER_META[provider].name} credentials?`)) return;
    setBusy((b) => ({ ...b, [provider]: true }));
    try {
      const r = await api.delete(`/settings/${provider}`);
      setData(r.data);
      setTestResult((t) => ({ ...t, [provider]: null }));
    } finally {
      setBusy((b) => ({ ...b, [provider]: false }));
    }
  };

  const connectTikTok = async () => {
    setBusy((b) => ({ ...b, tiktok_oauth: true }));
    try {
      const r = await api.get("/auth/tiktok/login");
      window.location.href = r.data.auth_url;
    } finally {
      setBusy((b) => ({ ...b, tiktok_oauth: false }));
    }
  };

  const disconnectTikTok = async () => {
    if (!window.confirm("Disconnect TikTok from this account?")) return;
    setBusy((b) => ({ ...b, tiktok_disconnect: true }));
    try {
      await api.delete("/disconnect/tiktok");
      await load();
    } finally {
      setBusy((b) => ({ ...b, tiktok_disconnect: false }));
    }
  };

  const submitTikTokPost = async () => {
    if (!videoFile) return;
    setBusy((b) => ({ ...b, tiktok_post: true }));
    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("caption", videoCaption);
      fd.append("hashtags", videoHashtags);
      fd.append("mode", videoMode);
      fd.append("privacy_level", "SELF_ONLY");
      if (videoScheduleAt) fd.append("schedule_at", new Date(videoScheduleAt).toISOString());
      await api.post("/post/tiktok", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setVideoFile(null);
      setVideoCaption("");
      setVideoHashtags("");
      setVideoScheduleAt("");
      await load();
      setSavedMsg(videoScheduleAt ? "TikTok post scheduled." : "TikTok video sent.");
      setTimeout(() => setSavedMsg(""), 2500);
    } finally {
      setBusy((b) => ({ ...b, tiktok_post: false }));
    }
  };

  if (!data) return <div className="p-12 font-mono text-zinc-400">Loading...</div>;

  return (
    <div className="p-8 lg:p-12" data-testid="settings-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">Integrations</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-4">Connect your accounts</h1>
      <p className="text-zinc-400 max-w-3xl mb-10">
        Plug in your own API keys for every store, ad network, and social platform. Your revenue stays in
        <span className="text-[#FFD600]"> your </span>accounts. We never see the payouts.
      </p>

      <TikTokConnectPanel
        status={tiktokStatus}
        posts={tiktokPosts}
        busy={busy}
        videoFile={videoFile}
        setVideoFile={setVideoFile}
        videoCaption={videoCaption}
        setVideoCaption={setVideoCaption}
        videoHashtags={videoHashtags}
        setVideoHashtags={setVideoHashtags}
        videoScheduleAt={videoScheduleAt}
        setVideoScheduleAt={setVideoScheduleAt}
        videoMode={videoMode}
        setVideoMode={setVideoMode}
        onConnect={connectTikTok}
        onDisconnect={disconnectTikTok}
        onSubmit={submitTikTokPost}
      />

      {savedMsg && (
        <div className="mb-6 bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-3 inline-block">
          Saved: {savedMsg}
        </div>
      )}

      {ORDER.map(([section, ids]) => (
        <div key={section} className="mb-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">{section}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800">
            {ids.map((pid) => {
              const meta = PROVIDER_META[pid];
              const state = data.providers[pid] || { fields: {}, configured: false, required: [] };
              const draft = edits[pid] || {};
              const result = testResult[pid];
              return (
                <div key={pid} className="bg-zinc-950 p-6" data-testid={`provider-${pid}`}>
                  <div className="flex items-start justify-between mb-3 gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-[#FFD600]" strokeWidth={2.5} />
                        <div className="font-heading text-2xl uppercase">{meta.name}</div>
                      </div>
                      <div className="text-zinc-400 text-sm">{meta.tagline}</div>
                    </div>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 whitespace-nowrap ${
                        state.configured ? "bg-[#FFD600] text-black" : "bg-zinc-800 text-zinc-400"
                      }`}
                      data-testid={`status-${pid}`}
                    >
                      {state.configured ? "CONNECTED" : "NOT SET"}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    {state.required.map((field) => (
                      <label key={field} className="block">
                        <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-1">
                          {meta.fieldLabels[field] || field}
                        </span>
                        <input
                          type={field.includes("token") || field.includes("key") ? "password" : "text"}
                          value={draft[field] ?? ""}
                          placeholder={state.fields[field] || "Enter value..."}
                          onChange={(e) => onChange(pid, field, e.target.value)}
                          className="w-full bg-transparent border border-zinc-800 px-3 py-2 text-white font-mono text-xs focus:border-[#FFD600] focus:outline-none"
                          data-testid={`input-${pid}-${field}`}
                        />
                      </label>
                    ))}
                  </div>

                  <a
                    href={meta.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-[#FFD600] mb-4"
                  >
                    Where to get this <ExternalLink className="w-3 h-3" />
                  </a>

                  {result && (
                    <div
                      className={`font-mono text-[10px] uppercase tracking-widest px-3 py-2 mb-3 flex items-center gap-2 ${
                        result.ok ? "bg-[#FFD600]/20 text-[#FFD600]" : "bg-[#FF3333]/20 text-[#FF3333]"
                      }`}
                      data-testid={`test-result-${pid}`}
                    >
                      {result.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {result.ok ? "Credentials valid" : (result.error || "Test failed")}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => save(pid)}
                      disabled={busy[pid] || Object.keys(draft).length === 0}
                      className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard disabled:opacity-40 flex items-center gap-2"
                      data-testid={`save-${pid}`}
                    >
                      {busy[pid] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </button>
                    {state.configured && (
                      <>
                        <button
                          onClick={() => test(pid)}
                          disabled={busy[`${pid}_test`]}
                          className="border border-zinc-700 text-zinc-200 font-mono text-xs uppercase tracking-widest px-4 py-2 hover:bg-white hover:text-black transition-colors flex items-center gap-2"
                          data-testid={`test-${pid}`}
                        >
                          {busy[`${pid}_test`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Test
                        </button>
                        <button
                          onClick={() => clearProvider(pid)}
                          className="border border-zinc-800 text-zinc-500 font-mono text-xs uppercase tracking-widest px-4 py-2 hover:text-[#FF3333] hover:border-[#FF3333] flex items-center gap-2"
                          data-testid={`clear-${pid}`}
                        >
                          <Trash2 className="w-3 h-3" /> Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TikTokConnectPanel({
  status,
  posts,
  busy,
  videoFile,
  setVideoFile,
  videoCaption,
  setVideoCaption,
  videoHashtags,
  setVideoHashtags,
  videoScheduleAt,
  setVideoScheduleAt,
  videoMode,
  setVideoMode,
  onConnect,
  onDisconnect,
  onSubmit,
}) {
  const connected = status?.connected;
  const profile = status?.profile || {};
  return (
    <section className="mb-12 border border-[#FFD600] bg-[#FFD600]/5" data-testid="tiktok-oauth-panel">
      <div className="border-b border-[#FFD600]/40 bg-black p-6">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600]">Official TikTok OAuth</div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-4xl uppercase">Connect TikTok posting</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-300">
              Uses TikTok Login Kit and Content Posting API only. Posting requires TikTok approval for video upload/publish scopes.
            </p>
          </div>
          <span className={`font-mono text-[10px] uppercase tracking-widest px-3 py-2 ${connected ? "bg-[#FFD600] text-black" : "bg-zinc-900 text-zinc-400"}`}>
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-zinc-800 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="bg-zinc-950 p-6">
          {connected ? (
            <div>
              <div className="mb-4 flex items-center gap-3">
                {profile.avatar_url && <img src={profile.avatar_url} alt="" className="h-12 w-12 border border-zinc-800 object-cover" />}
                <div>
                  <div className="font-heading text-2xl uppercase">{profile.display_name || "TikTok connected"}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{status?.scope || "Scopes granted"}</div>
                </div>
              </div>
              <button
                onClick={onDisconnect}
                disabled={busy.tiktok_disconnect}
                className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 hover:border-[#FF3333] hover:text-[#FF3333]"
              >
                {busy.tiktok_disconnect ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Disconnect TikTok
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={onConnect}
                disabled={busy.tiktok_oauth || status?.configured === false}
                className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black disabled:opacity-50"
                data-testid="connect-tiktok-oauth"
              >
                {busy.tiktok_oauth ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                Connect TikTok
              </button>
              {status?.configured === false && (
                <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#FF3333]">TikTok env vars are not configured on the backend.</div>
              )}
            </div>
          )}
        </div>

        <div className="bg-zinc-950 p-6">
          <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Upload or schedule video</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-zinc-400">Video file</span>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="w-full border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-300"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-zinc-400">Caption</span>
              <textarea
                value={videoCaption}
                onChange={(e) => setVideoCaption(e.target.value)}
                className="min-h-24 w-full border border-zinc-800 bg-black p-3 text-sm text-white focus:border-[#FFD600] focus:outline-none"
                placeholder="Caption and CTA..."
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-zinc-400">Hashtags</span>
              <input
                value={videoHashtags}
                onChange={(e) => setVideoHashtags(e.target.value)}
                className="w-full border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-[#FFD600] focus:outline-none"
                placeholder="digitalproducts launch"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-zinc-400">Schedule time</span>
              <input
                type="datetime-local"
                value={videoScheduleAt}
                onChange={(e) => setVideoScheduleAt(e.target.value)}
                className="w-full border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-[#FFD600] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-zinc-400">Mode</span>
              <select
                value={videoMode}
                onChange={(e) => setVideoMode(e.target.value)}
                className="w-full border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-[#FFD600] focus:outline-none"
              >
                <option value="direct">Direct Post</option>
                <option value="inbox">Inbox Upload</option>
              </select>
            </label>
            <button
              onClick={onSubmit}
              disabled={!connected || !videoFile || busy.tiktok_post}
              className="btn-hard flex items-center justify-center gap-2 bg-[#FF3333] px-4 py-2 font-mono text-xs uppercase tracking-widest text-white disabled:opacity-50"
            >
              {busy.tiktok_post ? <Loader2 className="h-3 w-3 animate-spin" /> : videoScheduleAt ? <UploadCloud className="h-3 w-3" /> : <Send className="h-3 w-3" />}
              {videoScheduleAt ? "Schedule" : "Send video"}
            </button>
          </div>

          {posts.length > 0 && (
            <div className="mt-6 border border-zinc-800 bg-black">
              <div className="border-b border-zinc-800 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Recent TikTok post jobs</div>
              <div className="divide-y divide-zinc-800">
                {posts.slice(0, 5).map((p) => (
                  <div key={p.id} className="grid gap-2 px-4 py-3 text-xs text-zinc-300 md:grid-cols-[1fr_auto]">
                    <div className="truncate">{p.filename || p.caption || p.id}</div>
                    <div className="font-mono uppercase tracking-widest text-[#FFD600]">{p.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
