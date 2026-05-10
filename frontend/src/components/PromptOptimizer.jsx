import { useState, useEffect } from "react";
import api from "../api";
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Zap } from "lucide-react";

export default function PromptOptimizer({ onSelectPrompt }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [quality, setQuality] = useState(null);

  const handleImprove = async () => {
    if (prompt.length < 10) return;
    setLoading(true);
    try {
      const res = await api.post("/prompts/improve", { prompt });
      setResult(res.data.result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Live quality check as the user types (debounced)
  useEffect(() => {
    if (prompt.length < 5) {
      setQuality(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.post("/prompts/check-quality", { prompt });
        setQuality(res.data.result);
      } catch (err) {
        console.error("Quality check failed", err);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [prompt]);

  return (
    <div className={`border transition-all duration-500 ${prompt.length > 0 ? "border-[#FFD600] bg-zinc-950 shadow-[0_0_20px_rgba(255,214,0,0.05)]" : "border-zinc-800 bg-black"} p-6 space-y-4`}>
      {prompt.length > 0 && (
        <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFD600] flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> AI Prompt Optimizer
          </div>
          {quality && (
            <div className={`font-mono text-[9px] uppercase tracking-tighter ${quality.quality_score > 70 ? "text-green-500" : "text-zinc-500"}`}>
              Quality Score: {quality.quality_score}%
            </div>
          )}
        </div>
      )}
      
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your product idea (e.g. 'A checklist for starting a dog walking business')..."
        className="w-full bg-black border border-zinc-800 p-4 font-mono text-sm text-white focus:border-[#FFD600] outline-none min-h-[100px]"
      />

      {prompt.length >= 5 && (
        <button
          onClick={handleImprove}
          disabled={loading || prompt.length < 10}
          className="w-full bg-[#FFD600] text-black font-mono text-[11px] uppercase tracking-widest font-bold py-3 hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 animate-in fade-in zoom-in-95"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-3 h-3" /> Analyze & Improve Prompt</>}
        </button>
      )}

      {result && (
        <div className="mt-4 p-4 border border-[#FFD600]/20 bg-[#FFD600]/5 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-1">
            <div className="text-[10px] text-[#FFD600] uppercase font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Improved Version
            </div>
            <p className="text-sm text-zinc-300 italic">"{result.improved_prompt}"</p>
          </div>

          {result.issues?.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-[#FF3333] uppercase font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Identified Gaps
              </div>
              <ul className="text-[10px] text-zinc-500 list-disc list-inside">
                {result.issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </div>
          )}

          <button 
            onClick={() => onSelectPrompt(result.improved_prompt)}
            className="text-[10px] uppercase text-[#FFD600] underline hover:no-underline">
            Use this improved prompt
          </button>
        </div>
      )}
    </div>
  );
}
