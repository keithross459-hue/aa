import { useEffect, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";

export default function CampaignsList() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/campaigns").then((r) => setItems(r.data)); }, []);

  return (
    <div className="p-8 lg:p-12" data-testid="campaigns-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Campaign vault</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-10">All campaigns</h1>

      {items.length === 0 ? (
        <div className="border border-zinc-800 bg-zinc-950 p-10 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
          No campaigns yet. Open a product and generate one.
        </div>
      ) : (
        <div className="border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800">
          {items.map((c) => (
            <Link key={c.id} to={`/app/products/${c.product_id}`} className="block p-5 hover:bg-zinc-900" data-testid={`camp-row-${c.id}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{c.product_title}</div>
                  <div className="font-heading text-2xl uppercase flex items-center gap-3">
                    <Megaphone className="w-5 h-5 text-[#FFD600]" /> {c.angle}
                  </div>
                </div>
                <div className="flex items-center gap-6 font-mono text-xs">
                  <span className="text-[#FFD600]">{c.variants.length} variants</span>
                  <span className="text-[#FF3333]">${c.daily_budget_suggestion}/day</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
