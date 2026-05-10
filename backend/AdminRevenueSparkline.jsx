import { useEffect, useState, useCallback } from "react";
import api from "../api";
import { TrendingUp } from "lucide-react";

export default function AdminRevenueSparkline() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/admin/revenue-sparkline");
      setData(r.data.data || []);
    } catch (ex) {
      console.error("Failed to load sparkline data", ex);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // Poll every minute
    return () => clearInterval(t);
  }, [load]);

  if (loading && data.length === 0) {
    return <div className="h-32 flex items-center justify-center text-zinc-500 font-mono text-[10px] uppercase animate-pulse">▮ Synchronizing...</div>;
  }

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (d.revenue / maxRevenue) * 100;
    return `${x},${y}`;
  }).join(" ");

  const totalRevenue = data.reduce((acc, curr) => acc + curr.revenue, 0);

  return (
    <div className="bg-black border border-zinc-800 p-4 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <TrendingUp className="w-3 h-3" /> 24H Revenue Velocity
        </div>
        <div className="text-sm text-[#FFD600] font-bold">${totalRevenue.toFixed(2)}</div>
      </div>
      
      <div className="relative h-24 w-full">
        <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1="0" y1="25" x2="100" y2="25" stroke="#18181B" strokeWidth="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="#18181B" strokeWidth="0.5" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="#18181B" strokeWidth="0.5" />
          
          <polyline
            fill="none"
            stroke="#FFD600"
            strokeWidth="2"
            strokeLinejoin="round"
            points={points}
          />
          
          <polyline
            fill="url(#sparkline-gradient)"
            stroke="none"
            points={`0,100 ${points} 100,100`}
          />
          
          <defs>
            <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFD600" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#FFD600" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      <div className="mt-2 flex justify-between text-[8px] text-zinc-600 uppercase tracking-tighter">
        <span>-24h</span>
        <span>Current Hour</span>
      </div>
    </div>
  );
}