import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { Loader2, Flame, TrendingUp, MousePointerClick, DollarSign, Target, Eye, CircleSlash, Download, X } from "lucide-react";

export default function AnalyticsPanel({ productId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showSignal, setShowSignal] = useState(false);
  const [lastSaleCount, setLastSaleCount] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/analytics/${productId}`);
      
      // Trigger Winning Signal if sales increased
      const newSales = r.data?.totals?.sales || 0;
      if (lastSaleCount !== null && newSales > lastSaleCount) {
        setShowSignal(true);
        // Play success sound
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3");
        audio.volume = 0.4;
        audio.play().catch(() => {
          // Browsers block audio until the user interacts with the page once
          console.log("Sound blocked: Await user interaction");
        });
        // Auto-hide after 5 seconds
        setTimeout(() => setShowSignal(false), 5000);
      }
      setLastSaleCount(newSales);
      
      setData(r.data);
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="p-10 flex items-center gap-3 text-zinc-400 font-mono text-xs uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading analytics...
      </div>
    );
  }
  if (err) return <div className="p-6 text-[#FF3333] font-mono text-xs uppercase tracking-widest">{err}</div>;
  if (!data) return null;

  const totals = data.totals || {};
  const rules = data.rules || {};
  const rows = data.performance || [];
  const loop = data.winner_loop || {};
  const top = loop.top_opportunity || {};

  return (
    <div className="border border-zinc-800 bg-zinc-950" data-testid="analytics-panel">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
        <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#FFD600]" /> Performance & winners
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 text-right">
          Winner rule: CTR &gt; {((rules.winner_min_ctr || 0) * 100).toFixed(0)}% and conv &gt; {((rules.min_conversion || 0) * 100).toFixed(0)}% with a purchase
        </div>
      </div>

      <div className="border-b border-zinc-800 bg-black px-6 py-4">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Winner Loop Controller</div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <div className="text-sm text-zinc-300">
            {top.product_id ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {top.is_winner && <Flame className="w-4 h-4 text-[#FFD600]" />}
                  <span>{top.reason}</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[#FFD600] font-bold">Next: {top.next_action}</span>
                  {top.is_winner && top.source === 'tiktok' && top.content_id && (
                    <a 
                      href={`/api/products/${productId}/promo-video/${top.content_id}?style=pain_solution`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#FFD600] text-black px-3 py-1 font-mono text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 hover:bg-yellow-400 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download Winning Ad
                    </a>
                  )}
                </div>
              </div>
            ) : "No opportunity yet. Waiting for real impressions, clicks, and conversion data."}
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest">
            <span className="bg-[#FFD600] px-2 py-1 text-black">{(loop.winner_products || []).length} scale</span>
            <span className="border border-zinc-700 px-2 py-1 text-zinc-300">{(loop.test_products || []).length} learn</span>
            <span className="bg-[#FF3333] px-2 py-1 text-white">{(loop.dead_products || []).length} kill</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-zinc-800">
        <Tile icon={<Eye />} label="Impressions" value={totals.impressions || 0} color="#FFD600" />
        <Tile icon={<MousePointerClick />} label="Clicks" value={totals.clicks || 0} color="#FFD600" />
        <Tile icon={<Target />} label="Sales" value={totals.sales || 0} color="#FF3333" />
        <Tile icon={<DollarSign />} label="Revenue" value={`$${totals.revenue || 0}`} color="#FFD600" />
        <Tile
          icon={<TrendingUp />}
          label="CTR / Conv"
          value={`${((totals.ctr || 0) * 100).toFixed(2)}% / ${((totals.conversion_rate || 0) * 100).toFixed(2)}%`}
          color="#FF3333"
        />
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest" data-testid="analytics-empty">
          No real tracking data yet. Use live product links to collect impressions, clicks, and purchases.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <Th>Content</Th>
                <Th right>Impr.</Th>
                <Th right>Clicks</Th>
                <Th right>Sales</Th>
                <Th right>CTR</Th>
                <Th right>Revenue</Th>
                <Th right>Conv %</Th>
                <Th right>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.source}-${r.content_id}`}
                  className={`border-b border-zinc-900 ${r.status === "WINNER" ? "bg-[#FFD600]/5" : ""}`}
                  data-testid={`analytics-row-${i}`}
                >
                  <Td>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 w-16">{r.source}</span>
                        <span className="font-mono text-sm">{r.content_id}</span>
                      </div>
                      {r.source === 'tiktok' && (
                        <a 
                          href={`/api/products/${productId}/promo-video/${r.content_id}?style=pain_solution`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#FFD600] hover:text-yellow-400 transition-colors"
                          title="Download Video"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </Td>
                  <Td right mono>{r.impressions}</Td>
                  <Td right mono>{r.clicks}</Td>
                  <Td right mono>{r.sales}</Td>
                  <Td right mono>{((r.ctr || 0) * 100).toFixed(2)}%</Td>
                  <Td right mono className="text-[#FFD600]">${r.revenue}</Td>
                  <Td right mono>{((r.conversion_rate || 0) * 100).toFixed(2)}%</Td>
                  <Td right>
                    {r.status === "WINNER" ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest bg-[#FFD600] text-black px-2 py-0.5">
                        <Flame className="w-3 h-3" /> Scale
                      </span>
                    ) : r.status === "DEAD" ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest bg-[#FF3333] text-white px-2 py-0.5">
                        <CircleSlash className="w-3 h-3" /> Kill
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Learn</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WINNING SIGNAL TOAST */}
      {showSignal && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="bg-[#FFD600] text-black border-2 border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-4 flex items-center gap-4">
            <div className="bg-black p-2">
              <Flame className="w-6 h-6 text-[#FFD600]" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase font-bold tracking-tighter">Winning Signal Detected</div>
              <div className="font-heading text-xl leading-none">NEW SALE TRACKED</div>
            </div>
            <button onClick={() => setShowSignal(false)} className="ml-4 hover:scale-110 transition-transform">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ icon, label, value, color }) {
  return (
    <div className="bg-zinc-950 p-5">
      <div style={{ color }} className="mb-2">{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">{label}</div>
      <div className="font-heading text-3xl">{value}</div>
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th className={`px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, right, mono, className = "" }) {
  return (
    <td className={`px-5 py-3 ${right ? "text-right" : "text-left"} ${mono ? "font-mono" : ""} ${className}`}>
      {children}
    </td>
  );
}
