import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { Loader2, Flame, TrendingUp, MousePointerClick, DollarSign, Target } from "lucide-react";

export default function AnalyticsPanel({ productId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/analytics/${productId}`);
      setData(r.data);
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // poll every 10s
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="p-10 flex items-center gap-3 text-zinc-400 font-mono text-xs uppercase tracking-widest">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading analytics…
      </div>
    );
  }
  if (err) {
    return <div className="p-6 text-[#FF3333] font-mono text-xs uppercase tracking-widest">{err}</div>;
  }
  if (!data) return null;

  const totals = data.totals || {};
  const rules = data.rules || {};
  const rows = data.performance || [];

  return (
    <div className="border border-zinc-800 bg-zinc-950" data-testid="analytics-panel">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#FFD600]" /> Performance & winners
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Winner rule: {rules.min_clicks}+ clicks @ {(rules.min_conversion * 100).toFixed(0)}%+ conv · OR · $
          {rules.min_revenue}+ revenue
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800">
        <Tile icon={<MousePointerClick />} label="Total clicks" value={totals.clicks || 0} color="#FFD600" />
        <Tile icon={<Target />} label="Total sales" value={totals.sales || 0} color="#FF3333" />
        <Tile icon={<DollarSign />} label="Revenue" value={`$${totals.revenue || 0}`} color="#FFD600" />
        <Tile
          icon={<TrendingUp />}
          label="Conversion"
          value={`${((totals.conversion_rate || 0) * 100).toFixed(2)}%`}
          color="#FF3333"
        />
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="p-10 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest" data-testid="analytics-empty">
          No clicks yet. Drop your /track/go links into TikTok bios to start tracking.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <Th>Content</Th>
                <Th right>Clicks</Th>
                <Th right>Sales</Th>
                <Th right>Revenue</Th>
                <Th right>Conv %</Th>
                <Th right>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.source}-${r.content_id}`}
                  className={`border-b border-zinc-900 ${r.is_winner ? "bg-[#FFD600]/5" : ""}`}
                  data-testid={`analytics-row-${i}`}
                >
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 w-16">
                        {r.source}
                      </span>
                      <span className="font-mono text-sm">{r.content_id}</span>
                    </div>
                  </Td>
                  <Td right mono>{r.clicks}</Td>
                  <Td right mono>{r.sales}</Td>
                  <Td right mono className="text-[#FFD600]">${r.revenue}</Td>
                  <Td right mono>{(r.conversion_rate * 100).toFixed(2)}%</Td>
                  <Td right>
                    {r.is_winner ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest bg-[#FFD600] text-black px-2 py-0.5">
                        <Flame className="w-3 h-3" /> Winner
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
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
