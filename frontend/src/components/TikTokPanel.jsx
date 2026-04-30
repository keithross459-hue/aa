import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import { Loader2, Copy, CheckCircle2, Flame, RefreshCw, Music2 } from "lucide-react";

function copy(text, onDone) {
  navigator.clipboard.writeText(text).then(() => onDone?.());
}

export default function TikTokPanel({ productId }) {
  const { refresh } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [err, setErr] = useState("");

  const flash = (k) => {
    setCopiedKey(k);
    setTimeout(() => setCopiedKey(""), 1400);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/tiktok/export/${productId}`);
      setData(r.data);
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setErr("");
    setBusy(true);
    try {
      await api.post(`/tiktok/generate/${productId}`);
      await Promise.all([load(), refresh()]);
    } catch (ex) {
      const d = ex?.response?.data?.detail;
      if (d?.code === "LIMIT_REACHED") setErr(d.message);
      else setErr(typeof d === "string" ? d : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  const posts = data?.posts || [];

  return (
    <div className="border border-zinc-800 bg-zinc-950" data-testid="tiktok-panel">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Music2 className="w-4 h-4 text-[#FF3333]" />
          <div className="font-mono text-xs uppercase tracking-widest">TikTok Content Engine — {posts.length} posts</div>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="bg-[#FF3333] text-white font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard btn-hard-red disabled:opacity-60 flex items-center gap-2"
          data-testid="tiktok-generate-btn"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {posts.length === 0 ? "Generate 5 posts" : "Regenerate"}
        </button>
      </div>

      {err && (
        <div className="bg-[#FF3333]/10 border-b border-[#FF3333] text-[#FF3333] font-mono text-xs uppercase tracking-widest px-6 py-3">
          {String(err)}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center gap-3 text-zinc-400 font-mono text-xs uppercase tracking-widest">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading posts…
        </div>
      ) : posts.length === 0 ? (
        <div className="p-10 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
          No posts yet. Click "Generate 5 posts" to feed your daily content engine.
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {posts.map((p, i) => (
            <div key={p.id || i} className="p-6" data-testid={`tiktok-post-${i}`}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Post #{i + 1}</span>
                  {i === 0 && (
                    <span className="font-mono text-[10px] uppercase tracking-widest bg-[#FFD600] text-black px-2 py-0.5 flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Best pick
                    </span>
                  )}
                </div>
                <button
                  onClick={() =>
                    copy(
                      `HOOK:\n${p.hook}\n\nSCRIPT:\n${p.script}\n\nCAPTION:\n${p.caption}\n\nHASHTAGS:\n${p.hashtags.map((h) => "#" + h).join(" ")}\n\nVISUAL:\n${p.visual_idea}`,
                      () => flash(`post-${i}`)
                    )
                  }
                  className="font-mono text-[10px] uppercase tracking-widest border border-zinc-700 px-3 py-1.5 hover:bg-white hover:text-black transition-colors inline-flex items-center gap-2"
                  data-testid={`copy-tiktok-${i}`}
                >
                  {copiedKey === `post-${i}` ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedKey === `post-${i}` ? "Copied" : "Copy post"}
                </button>
              </div>

              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Hook</div>
              <div className="font-heading text-2xl uppercase mb-4 leading-tight">{p.hook}</div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Script (20-40s)</div>
                  <pre className="text-zinc-300 text-sm whitespace-pre-wrap font-body bg-black border border-zinc-800 p-3">
                    {p.script}
                  </pre>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Caption</div>
                  <div className="text-zinc-300 text-sm bg-black border border-zinc-800 p-3 mb-3">{p.caption}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Visual idea</div>
                  <div className="text-zinc-400 text-xs bg-black border border-zinc-800 p-3 mb-3">{p.visual_idea}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Hashtags</div>
                  <div className="flex flex-wrap gap-1">
                    {p.hashtags.map((h, hi) => (
                      <span key={hi} className="font-mono text-[10px] text-zinc-200 bg-zinc-900 border border-zinc-800 px-2 py-0.5">
                        #{h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
