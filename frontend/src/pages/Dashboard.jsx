import { useEffect, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";
import { Package, Megaphone, Rocket, TrendingUp, Plus, Settings as SettingsIcon } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([api.get("/stats"), api.get("/products")]);
      setStats(s.data);
      setProducts(p.data.slice(0, 5));
    })();
  }, []);

  const tiles = [
    { label: "Products", value: stats?.products ?? "—", icon: <Package />, color: "#FFD600" },
    { label: "Campaigns", value: stats?.campaigns ?? "—", icon: <Megaphone />, color: "#FF3333" },
    { label: "Store Listings", value: stats?.listings ?? "—", icon: <Rocket />, color: "#FFD600" },
    {
      label: "Generations Used",
      value: stats ? `${stats.generations_used}/${stats.plan_limit}` : "—",
      icon: <TrendingUp />,
      color: "#FF3333",
    },
  ];

  return (
    <div className="p-8 lg:p-12" data-testid="dashboard-page">
      <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Control room</div>
          <h1 className="font-heading text-5xl lg:text-6xl uppercase">Dashboard</h1>
        </div>
        <Link
          to="/app/products"
          className="bg-[#FF3333] text-white font-mono text-xs uppercase tracking-widest px-6 py-4 btn-hard btn-hard-red flex items-center gap-2"
          data-testid="dash-new-product-btn"
        >
          <Plus className="w-4 h-4" /> Forge new product
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800 border border-zinc-800 mb-10">
        {tiles.map((t, i) => (
          <div key={i} className="bg-zinc-950 p-6" data-testid={`stat-${t.label.toLowerCase().replace(/ /g, "-")}`}>
            <div style={{ color: t.color }} className="mb-4">{t.icon}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">{t.label}</div>
            <div className="font-heading text-5xl">{t.value}</div>
          </div>
        ))}
      </div>

      {stats && stats.integrations_configured < stats.integrations_total && (
        <Link
          to="/app/settings"
          className="block mb-10 border border-[#FFD600] bg-[#FFD600]/5 p-6 hover:bg-[#FFD600]/10 transition-colors"
          data-testid="connect-integrations-cta"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">
                <SettingsIcon className="w-3 h-3" /> Keep your money — connect your stores
              </div>
              <div className="font-heading text-3xl uppercase">
                {stats.integrations_configured} / {stats.integrations_total} integrations connected
              </div>
              <div className="text-zinc-400 text-sm mt-2">
                Plug in your own Gumroad, Stan Store, Whop, Payhip, Stripe, Meta, TikTok keys. Payouts land in
                <span className="text-white"> your </span>accounts.
              </div>
            </div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#FFD600]">Connect now →</div>
          </div>
        </Link>
      )}

      {stats && stats.plan !== "free" && (
        <div className="mb-10 border border-zinc-800 bg-zinc-950 p-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">▮ Subscription</div>
            <div className="font-heading text-2xl uppercase">
              {stats.plan} — {stats.generations_used}/{stats.plan_limit} generations this cycle
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/app/referrals" className="border border-zinc-700 text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:bg-white hover:text-black">
              Share + earn
            </Link>
          </div>
        </div>
      )}

      <div className="border border-zinc-800 bg-zinc-950">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="font-mono text-xs uppercase tracking-widest">Latest products</div>
          <Link to="/app/products" className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white">
            view all →
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-4">No products yet</div>
            <Link
              to="/app/products"
              className="inline-block bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-6 py-3 btn-hard"
              data-testid="dash-empty-cta"
            >
              Generate your first →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/app/products/${p.id}`}
                className="flex items-center justify-between p-5 hover:bg-zinc-900 transition-colors"
                data-testid={`dash-product-${p.id}`}
              >
                <div>
                  <div className="font-heading text-2xl uppercase">{p.title}</div>
                  <div className="text-zinc-400 text-sm">{p.tagline}</div>
                </div>
                <div className="flex items-center gap-6 font-mono text-xs">
                  <span className="text-zinc-400">${p.price}</span>
                  <span className="text-[#FFD600]">{p.campaigns_count} ads</span>
                  <span className="text-[#FF3333]">{p.launched_stores.length} stores</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
