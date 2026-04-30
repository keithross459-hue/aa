import { useEffect, useState } from "react";
import api from "../api";
import { ExternalLink, Rocket } from "lucide-react";

export default function LaunchesList() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/listings").then((r) => setItems(r.data.listings || [])); }, []);

  return (
    <div className="p-8 lg:p-12" data-testid="launches-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Storefront ledger</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-10">Live store listings</h1>

      {items.length === 0 ? (
        <div className="border border-zinc-800 bg-zinc-950 p-10 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
          Nothing live yet. Open a product and launch it.
        </div>
      ) : (
        <div className="border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800">
          {items.map((l) => (
            <div key={l.id} className="p-5 flex items-center justify-between flex-wrap gap-4" data-testid={`listing-${l.id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <Rocket className="w-4 h-4 text-[#FF3333]" />
                  <span
                    className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 ${
                      l.status === "LIVE" ? "bg-[#FFD600] text-black" :
                      l.status === "SIMULATED" ? "bg-zinc-700 text-zinc-200" :
                      l.status === "NOT_CONFIGURED" ? "bg-zinc-800 text-zinc-400 border border-[#FFD600]" :
                      "bg-[#FF3333] text-white"
                    }`}
                  >
                    {l.status || "LIVE"}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">{l.store_name}</span>
                </div>
                <div className="font-heading text-2xl uppercase truncate">{l.listing_title}</div>
                {l.status === "NOT_CONFIGURED" ? (
                  <div className="font-mono text-xs text-[#FFD600]">
                    {l.error || `Add your ${l.store_name} credentials in Settings to publish for real.`}
                  </div>
                ) : (
                  <a href={l.listing_url} target="_blank" rel="noreferrer" className="font-mono text-xs text-zinc-400 hover:text-[#FFD600] flex items-center gap-1 break-all">
                    {l.listing_url} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
