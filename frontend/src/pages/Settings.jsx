import { useEffect, useState } from "react";
import api from "../api";
import { Loader2, CheckCircle2, XCircle, Save, Trash2, Zap, ExternalLink } from "lucide-react";

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
    tagline: "Use your own OpenAI key for generations (optional — platform key is default).",
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

  const load = async () => {
    const r = await api.get("/settings");
    setData(r.data);
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

  if (!data) return <div className="p-12 font-mono text-zinc-400">Loading…</div>;

  return (
    <div className="p-8 lg:p-12" data-testid="settings-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Integrations</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-4">Connect your accounts</h1>
      <p className="text-zinc-400 max-w-3xl mb-10">
        Plug in your own API keys for every store, ad network, and social platform. Your revenue stays in
        <span className="text-[#FFD600]"> your </span>accounts. We never see the payouts.
      </p>

      {savedMsg && (
        <div className="mb-6 bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-3 inline-block">
          ✓ {savedMsg}
        </div>
      )}

      {ORDER.map(([section, ids]) => (
        <div key={section} className="mb-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">▮ {section}</div>
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
                          placeholder={state.fields[field] || "Enter value…"}
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
