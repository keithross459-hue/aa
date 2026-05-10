import { useCallback, useEffect, useState, useRef } from "react";
import api from "../api";
import { Loader2, Flame, DollarSign, Activity, Clock } from "lucide-react";

export default function AdminGlobalFeed() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastSignalId, setLastSignalId] = useState(null);
  const hasInteracted = useRef(false);

  const playSound = (type) => {
    if (!hasInteracted.current) return;
    
    // High-pitched chime for promotion, standard coin sound for sales
    const url = type === "winner_promoted" 
      ? "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3" 
      : "https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3";
      
    const audio = new Audio(url);
    audio.volume = 0.3;
    audio.play().catch(() => {});
  };

  const load = useCallback(async () => {
    try {
      const r = await api.get("/admin/global-feed");
      const newFeed = r.data?.feed || [];
      
      if (newFeed.length > 0) {
        const latest = newFeed[0];
        // If the ID has changed since last poll, evaluate for sound
        if (lastSignalId && latest.id !== lastSignalId) {
          if (latest.event_type === "winner_promoted") {
            playSound("winner_promoted");
          } else if (latest.event_type === "sale") {
            playSound("sale");
          }
        }
        setLastSignalId(latest.id);
      }
      
      setFeed(newFeed);
    } catch (ex) {
      console.error("Failed to load global feed", ex);
    } finally {
      setLoading(false);
    }
  }, [lastSignalId]);

  useEffect(() => {
    const handleInteract = () => { hasInteracted.current = true; };
    window.addEventListener("click", handleInteract);
    
    load();
    const t = setInterval(load, 15000); // Poll every 15s
    
    return () => {
      clearInterval(t);
      window.removeEventListener("click", handleInteract);
    };
  }, [load]);

  if (loading && feed.length === 0) {
    return <div className="p-10 text-zinc-500 font-mono text-xs animate-pulse">▮ INITIALIZING FEED...</div>;
  }

  return (
    <div className="bg-black border border-zinc-800 font-mono">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
        <div className="text-[10px] uppercase tracking-widest text-[#FFD600] flex items-center gap-2">
          <Activity className="w-3 h-3" /> Live Signal Ingestion
        </div>
        {!hasInteracted.current && <span className="text-[9px] text-zinc-600 animate-pulse">Click anywhere to enable audio alerts</span>}
      </div>
      <div className="divide-y divide-zinc-900 max-h-[600px] overflow-y-auto">
        {feed.map((s) => (
          <div key={s.id} className={`p-4 flex items-start justify-between gap-4 transition-colors ${s.event_type === 'winner_promoted' ? 'bg-[#FFD600]/5' : ''}`}>
            <div className="flex gap-4">
              <div className={`p-2 border ${s.event_type === 'winner_promoted' ? 'border-[#FFD600] text-[#FFD600]' : 'border-zinc-800 text-zinc-500'}`}>
                {s.event_type === 'winner_promoted' ? <Flame className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs text-white uppercase font-bold">{s.user_name}</div>
                <div className="text-[10px] text-zinc-500 uppercase">{s.product_title}</div>
                <div className="mt-1 text-[11px] text-[#FFD600]">
                  {s.event_type === 'winner_promoted' ? 'SCALE SIGNAL: PROMOTED TO WINNER' : `SALE RECORDED: $${s.value}`}
                </div>
              </div>
            </div>
            <div className="text-[9px] text-zinc-700 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {new Date(s.created_at).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {feed.length === 0 && <div className="p-10 text-center text-zinc-700 text-xs">Waiting for incoming signals...</div>}
      </div>
    </div>
  );
}