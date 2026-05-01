import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";
import { CheckCircle2, MousePointerClick, Rocket, ShoppingCart } from "lucide-react";
import { startStepTimer, trackOnboarding } from "../lib/onboardingTelemetry";

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [signal, setSignal] = useState(null);

  useEffect(() => {
    return startStepTimer("dashboard_next_action");
  }, []);

  useEffect(() => {
    (async () => {
      const p = await api.get("/products");
      setProducts(p.data);
    })();
  }, []);

  const activeProduct = useMemo(() => {
    if (products.length === 0) return null;
    return products.find((p) => p.launched_stores?.length && !p.sales_count) || products[0];
  }, [products]);

  useEffect(() => {
    if (!activeProduct?.id || !activeProduct.launched_stores?.length) {
      setSignal(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const r = await api.get(`/first-result/${activeProduct.id}`);
        if (alive) setSignal(r.data);
      } catch {
        if (alive) setSignal(null);
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [activeProduct?.id, activeProduct?.launched_stores?.length]);

  const next = nextAction(activeProduct, signal);

  return (
    <div className="p-6 lg:p-10" data-testid="dashboard-page">
      <div className="mb-8">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">Start here</div>
        <h1 className="font-heading text-5xl uppercase lg:text-6xl">Get your first result</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">One product. One next action. No extra noise.</p>
      </div>

      {!activeProduct ? (
        <section className="border border-[#FFD600] bg-[#FFD600]/10 p-6">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Step 1</div>
          <div className="font-heading text-4xl uppercase">Choose a niche</div>
          <p className="mt-2 max-w-xl text-zinc-300">Create the first product before looking at anything else.</p>
          <Link
            to="/app/products"
            onClick={() => trackOnboarding("primary_cta_clicked", { cta: "dashboard_start_here" })}
            className="btn-hard mt-5 inline-flex items-center gap-2 bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black"
            data-testid="dashboard-start-here"
          >
            Start here
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 xl:grid-cols-[1fr_360px]">
          <section className="bg-zinc-950 p-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Active product</div>
            <h2 className="font-heading text-4xl uppercase">{activeProduct.title}</h2>
            <p className="mt-2 max-w-2xl text-zinc-400">{activeProduct.tagline}</p>

            <div className="mt-6 border border-[#FFD600] bg-[#FFD600]/10 p-5">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">Next recommended action</div>
              <div className="font-heading text-3xl uppercase">{next.title}</div>
              <p className="mt-1 text-sm text-zinc-300">{next.body}</p>
              <Link
                to={next.href}
                onClick={() => trackOnboarding("primary_cta_clicked", { cta: next.id, product_id: activeProduct.id })}
                className={`btn-hard mt-4 inline-flex items-center gap-2 px-5 py-3 font-mono text-xs uppercase tracking-widest ${next.red ? "bg-[#FF3333] text-white btn-hard-red" : "bg-[#FFD600] text-black"}`}
                data-testid="dashboard-next-action"
              >
                {next.cta}
              </Link>
            </div>
          </section>

          <aside className="bg-zinc-950 p-6">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">First result progress</div>
            <div className="space-y-3">
              <ProgressRow done label="Product created" />
              <ProgressRow done={activeProduct.launched_stores?.length > 0} label="Product launched" />
              <ProgressRow done={signal?.milestones?.first_post || signal?.milestones?.first_engagement} label="First TikTok copied" />
              <ProgressRow done={signal?.milestones?.first_click} label="First click" />
              <ProgressRow done={signal?.milestones?.first_sale} label="First sale" />
            </div>

            <div className="mt-6 grid grid-cols-3 gap-px bg-zinc-800">
              <MiniStat icon={<MousePointerClick />} label="Clicks" value={signal?.totals?.clicks || 0} />
              <MiniStat icon={<ShoppingCart />} label="Sales" value={signal?.totals?.sales || 0} />
              <MiniStat icon={<Rocket />} label="Live" value={activeProduct.launched_stores?.length || 0} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function nextAction(product, signal) {
  if (!product) {
    return { id: "start", title: "Choose a niche", body: "Start with one niche and one product.", cta: "Start here", href: "/app/products" };
  }
  if (!product.launched_stores?.length) {
    return { id: "launch_now", title: "Launch now", body: "Your first meaningful action is getting this product live.", cta: "Launch now", href: `/app/products/${product.id}`, red: true };
  }
  if (!signal?.milestones?.first_post && !signal?.milestones?.first_engagement) {
    return { id: "copy_tiktok", title: "Copy your first TikTok", body: "Promotion creates traffic. Copy one post and publish it.", cta: "Get your first result", href: `/app/products/${product.id}#traffic-engine` };
  }
  if (!signal?.milestones?.first_click) {
    return { id: "check_momentum", title: "Check for activity", body: "You took action. Watch for the first click.", cta: "Check progress", href: `/app/products/${product.id}` };
  }
  return { id: "keep_going", title: "Momentum started", body: "You have a signal. Keep pushing this product.", cta: "Open product", href: `/app/products/${product.id}` };
}

function ProgressRow({ done, label }) {
  return (
    <div className="flex items-center gap-3 border border-zinc-800 bg-black p-3">
      <span className={`flex h-6 w-6 items-center justify-center border ${done ? "border-[#FFD600] bg-[#FFD600] text-black" : "border-zinc-700 text-zinc-600"}`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : null}
      </span>
      <span className={`font-mono text-xs uppercase tracking-widest ${done ? "text-zinc-100" : "text-zinc-500"}`}>{label}</span>
    </div>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="bg-black p-3">
      <div className="mb-1 text-[#FFD600]">{icon}</div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-heading text-2xl uppercase">{value}</div>
    </div>
  );
}
