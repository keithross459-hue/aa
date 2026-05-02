import { useState } from "react";
import api from "../api";
import { Download, Loader2, Rocket, Sparkles } from "lucide-react";

export default function Machine() {
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    if (!idea.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.post("/machine/run", { idea, audience: audience || undefined, product_type: "ebook", launch_stores: true, activate_referrals: true });
      setResult(r.data);
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Auto Mode is disabled in real-only mode.");
    } finally {
      setBusy(false);
    }
  };

  const downloadZip = async () => {
    if (!result?.product?.id) return;
    const r = await api.get(`/machine/export/${result.product.id}/zip`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fiilthy-machine-${result.product.id}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 lg:p-12" data-testid="machine-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">One click business machine</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-10">Idea to launch</h1>
      {err && <div className="mb-6 border border-[#FF3333] bg-[#FF3333]/10 px-4 py-3 font-mono text-xs uppercase tracking-widest text-[#FF3333]">{err}</div>}

      <section className="border border-zinc-800 bg-zinc-950 p-6 mb-10">
        <div className="grid lg:grid-cols-[1fr_280px_auto] gap-3">
          <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="AI fitness templates for busy founders" className="bg-transparent border border-zinc-800 px-4 py-4 text-white text-lg focus:border-[#FFD600] focus:outline-none" />
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience" className="bg-transparent border border-zinc-800 px-4 py-4 text-white focus:border-[#FFD600] focus:outline-none" />
          <button onClick={run} disabled={busy || !idea.trim()} className="bg-[#FF3333] text-white font-mono text-xs uppercase tracking-widest px-6 py-4 btn-hard btn-hard-red flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run
          </button>
        </div>
      </section>

      {result && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800">
            <Tile title="Branding" items={[result.branding.name, result.branding.tagline, result.branding.voice]} />
            <Tile title="Product" items={[result.product.title, result.product.description, `$${result.product.price}`]} />
            <Tile title="Launch" items={[`${result.listings.length} store targets`, result.analytics_tracking.posthog_event, result.referral_activation.enabled ? `Referral ${result.referral_activation.code}` : "Referral off"]} />
          </div>

          <section className="border border-zinc-800 bg-zinc-950">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
              <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2"><Rocket className="w-4 h-4 text-[#FFD600]" /> Generated launch stack</div>
              <button onClick={downloadZip} className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard flex items-center gap-2">
                <Download className="w-4 h-4" /> ZIP export
              </button>
            </div>
            <div className="grid lg:grid-cols-3 gap-px bg-zinc-800">
              <Tile title="TikTok scripts" items={result.tiktok_scripts.map((x) => x.title)} />
              <Tile title="Email funnel" items={result.email_funnel.map((x) => x.subject)} />
              <Tile title="Retargeting" items={result.retargeting_setup.audiences} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Tile({ title, items }) {
  return (
    <div className="bg-zinc-950 p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4">{title}</div>
      <div className="space-y-3">
        {items.map((item, i) => <div key={i} className="text-zinc-300 text-sm border-b border-zinc-900 pb-2">{item}</div>)}
      </div>
    </div>
  );
}
