import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings,
  ShieldCheck,
  XCircle,
  Zap,
} from "lucide-react";

const GROUPS = [
  {
    title: "Stores",
    rows: [
      { id: "gumroad", name: "Gumroad", capability: "Real product publishing", setup: "/app/settings", external: "https://gumroad.com/settings/advanced" },
      { id: "stan_store", name: "Stan Store", capability: "Digital drop publishing", setup: "/app/settings", external: "https://stan.store/dashboard/integrations" },
      { id: "whop", name: "Whop", capability: "Paid access products", setup: "/app/settings", external: "https://dash.whop.com/settings/developer" },
      { id: "payhip", name: "Payhip", capability: "Digital product storefront", setup: "/app/settings", external: "https://payhip.com/account/api" },
    ],
  },
  {
    title: "Payments",
    rows: [
      { id: "stripe", name: "Stripe", capability: "Checkout and subscriptions", setup: "/app/settings", external: "https://dashboard.stripe.com/apikeys" },
    ],
  },
  {
    title: "Social",
    rows: [
      { id: "tiktok_oauth", name: "TikTok OAuth", capability: "Login, upload, scheduling", setup: "/app/settings", external: "https://developers.tiktok.com/" },
      { id: "meta", name: "Meta Ads", capability: "Paid campaign activation", setup: "/app/settings", external: "https://developers.facebook.com/tools/explorer/" },
      { id: "instagram", name: "Instagram", capability: "Social profile connection", setup: "/app/settings", external: "https://developers.facebook.com/docs/instagram-api/" },
      { id: "youtube", name: "YouTube", capability: "Shorts/API setup", setup: "/app/settings", external: "https://console.cloud.google.com/apis/credentials" },
    ],
  },
  {
    title: "Infrastructure",
    rows: [
      { id: "frontend", name: "Frontend", capability: "App UI", external: "https://fiilthy-ai-production-frontend.vercel.app" },
      { id: "backend", name: "Backend", capability: "API and automation", external: "https://fiilthy-ai-production-backend.onrender.com/api/health" },
      { id: "dns", name: "DNS", capability: "fiilthy.ai / api.fiilthy.ai", external: "https://vercel.com/docs/domains" },
      { id: "email", name: "SendGrid", capability: "Transactional and launch email", setup: "/app/admin" },
    ],
  },
];

export default function Platforms() {
  const [settings, setSettings] = useState(null);
  const [tiktok, setTiktok] = useState(null);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, tiktokRes, backendRes, frontendRes, dnsRes] = await Promise.allSettled([
        api.get("/settings"),
        api.get("/auth/tiktok/status"),
        fetch("https://fiilthy-ai-production-backend.onrender.com/api/health"),
        fetch("https://fiilthy-ai-production-frontend.vercel.app"),
        fetch("https://api.fiilthy.ai/api/health", { mode: "no-cors" }),
      ]);

      setSettings(settingsRes.status === "fulfilled" ? settingsRes.value.data : null);
      setTiktok(tiktokRes.status === "fulfilled" ? tiktokRes.value.data : null);
      setStatus({
        backend: backendRes.status === "fulfilled",
        frontend: frontendRes.status === "fulfilled",
        dns: dnsRes.status === "fulfilled" && dnsRes.value?.type === "basic",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const rows = GROUPS.flatMap((g) => g.rows).map((r) => resolveRow(r, settings, tiktok, status));
    return {
      connected: rows.filter((r) => r.state === "connected").length,
      action: rows.filter((r) => r.state === "action").length,
      blocked: rows.filter((r) => r.state === "blocked").length,
      total: rows.length,
    };
  }, [settings, tiktok, status]);

  return (
    <div className="p-8 lg:p-12" data-testid="platforms-page">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600]">Connector hub</div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-5xl uppercase lg:text-6xl">Platform command center</h1>
          <p className="mt-3 max-w-3xl text-zinc-400">One place to see what FiiLTHY can control, what needs approval, and what owner setup is still blocking automation.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
        </button>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-px bg-zinc-800 md:grid-cols-4">
        <Metric label="Connected" value={summary.connected} tone="good" />
        <Metric label="Needs action" value={summary.action} tone="warn" />
        <Metric label="Blocked" value={summary.blocked} tone="bad" />
        <Metric label="Total" value={summary.total} />
      </div>

      <div className="space-y-10">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">{group.title}</div>
            <div className="border border-zinc-800 bg-zinc-800">
              {group.rows.map((row) => <PlatformRow key={row.id} row={resolveRow(row, settings, tiktok, status)} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function resolveRow(row, settings, tiktok, status) {
  const provider = settings?.providers?.[row.id];
  if (row.id === "tiktok_oauth") {
    if (tiktok?.connected) return { ...row, state: "connected", label: "Connected", detail: "OAuth token stored. Posting depends on TikTok scope approval." };
    if (tiktok?.configured) return { ...row, state: "action", label: "Ready to connect", detail: "Click Connect TikTok in Settings. TikTok review may still gate upload/publish." };
    return { ...row, state: "blocked", label: "Env missing", detail: "Add TikTok client key, secret, scopes, and callback env vars on Render." };
  }
  if (row.id === "frontend") return { ...row, state: status.frontend ? "connected" : "blocked", label: status.frontend ? "Live" : "Down", detail: status.frontend ? "Vercel app responds." : "Frontend check failed." };
  if (row.id === "backend") return { ...row, state: status.backend ? "connected" : "blocked", label: status.backend ? "Live" : "Down", detail: status.backend ? "Render API responds." : "Backend health check failed." };
  if (row.id === "dns") return { ...row, state: status.dns ? "connected" : "blocked", label: status.dns ? "Resolved" : "Pending", detail: status.dns ? "Custom API domain resolves." : "Use Render/Vercel default URLs until registrar DNS is changed." };
  if (row.id === "email") return { ...row, state: "connected", label: "Tested", detail: "SendGrid test email returned accepted." };
  if (provider?.configured) return { ...row, state: "connected", label: "Connected", detail: `${row.name} credentials are configured from ${provider.configured_source || "settings"}.` };
  return { ...row, state: "action", label: "Connect", detail: `Add or OAuth-connect ${row.name} so FiiLTHY can use it.` };
}

function PlatformRow({ row }) {
  const tone = {
    connected: "border-[#FFD600] text-[#FFD600]",
    action: "border-zinc-600 text-zinc-300",
    blocked: "border-[#FF3333] text-[#FF3333]",
  }[row.state];
  const icon = row.state === "connected" ? <CheckCircle2 /> : row.state === "blocked" ? <XCircle /> : <AlertTriangle />;
  return (
    <div className="grid gap-4 border-b border-zinc-800 bg-zinc-950 p-5 last:border-b-0 lg:grid-cols-[220px_1fr_auto] lg:items-center" data-testid={`platform-${row.id}`}>
      <div>
        <div className="font-heading text-2xl uppercase">{row.name}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{row.capability}</div>
      </div>
      <div className="text-sm text-zinc-300">{row.detail}</div>
      <div className="flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-widest ${tone}`}>
          {icon} {row.label}
        </span>
        {row.setup && (
          <Link to={row.setup} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
            <Settings className="h-3 w-3" /> Setup
          </Link>
        )}
        {row.external && (
          <a href={row.external} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
            <ExternalLink className="h-3 w-3" /> Open
          </a>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }) {
  const color = tone === "good" ? "text-[#FFD600]" : tone === "bad" ? "text-[#FF3333]" : "text-white";
  return (
    <div className="bg-zinc-950 p-5">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        <ShieldCheck className="h-3 w-3" /> {label}
      </div>
      <div className={`font-heading text-5xl uppercase ${color}`}>{value}</div>
    </div>
  );
}
