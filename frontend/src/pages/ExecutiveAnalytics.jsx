import { useEffect, useState } from "react";
import api from "../api";
import { BarChart3, DollarSign, FlaskConical, MousePointer2, Radio, Users } from "lucide-react";

export default function ExecutiveAnalytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/analytics/executive").then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="p-12 font-mono text-zinc-400">Loading analytics...</div>;

  const metrics = [
    ["MRR", `$${data.revenue.mrr}`, <DollarSign />],
    ["ARR", `$${data.revenue.arr}`, <DollarSign />],
    ["Churn", `${Math.round(data.growth.churn * 100)}%`, <Users />],
    ["LTV", `$${data.revenue.ltv}`, <BarChart3 />],
    ["CAC", `$${data.revenue.cac}`, <MousePointer2 />],
    ["Conversion", `${Math.round(data.growth.conversion * 100)}%`, <Radio />],
    ["Onboarding", `${Math.round(data.growth.onboarding_completion * 100)}%`, <Users />],
    ["Launch success", `${Math.round(data.growth.launch_success_rate * 100)}%`, <FlaskConical />],
  ];

  return (
    <div className="p-8 lg:p-12" data-testid="analytics-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">PostHog + revenue brain</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-10">Executive analytics</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800 mb-10">
        {metrics.map(([label, value, icon]) => (
          <div key={label} className="bg-zinc-950 p-6">
            <div className="text-[#FFD600] mb-3">{icon}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">{label}</div>
            <div className="font-heading text-4xl">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800">
        <Panel title="Top niches" rows={data.content.top_niches.map((x) => [x.name, x.count])} />
        <Panel title="Best products" rows={data.content.best_products.map((x) => [x.title, `$${x.revenue}`])} />
        <Panel title="Best ads" rows={data.content.best_ads.map((x) => [`${x.source}:${x.content_id}`, `$${x.revenue}`])} />
        <Panel title="Retention cohorts" rows={data.retention_cohorts.map((x) => [`${x.window_days}d`, `${Math.round(x.retention * 100)}%`])} />
        <Panel title="Funnel dropoff" rows={Object.entries(data.funnel_dropoff).map(([k, v]) => [k.replaceAll("_", " "), `${Math.round(v * 100)}%`])} />
        <Panel title="Product analytics" rows={[["Heatmaps", data.posthog.heatmaps], ["Recordings", data.posthog.session_recordings], ["A/B tests", data.posthog.ab_tests]]} />
      </div>
    </div>
  );
}

function Panel({ title, rows }) {
  return (
    <section className="bg-zinc-950">
      <div className="px-5 py-4 border-b border-zinc-800 font-mono text-xs uppercase tracking-widest">{title}</div>
      <div className="divide-y divide-zinc-800">
        {(rows.length ? rows : [["No data yet", "-"]]).map(([a, b], i) => (
          <div key={`${a}-${i}`} className="p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-300 truncate">{a}</div>
            <div className="font-heading text-xl uppercase text-[#FFD600] text-right">{b}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
