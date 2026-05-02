import { Link } from "react-router-dom";
import { Package, Settings, ShieldCheck } from "lucide-react";

export default function Machine() {
  return (
    <div className="p-8 lg:p-12" data-testid="machine-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">Real-only mode</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-6">Auto Mode is off</h1>
      <p className="mb-10 max-w-3xl text-zinc-300">
        One-click automation was disabled because it created generated launch stacks without real store publishing. Build the product, connect a real store, then publish through the verified launch flow.
      </p>

      <section className="grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-3">
        <RealStep icon={<Package />} title="Build" body="Create or edit a product in the builder. Generated drafts are saved as drafts, not launches." to="/app/products" cta="Open builder" />
        <RealStep icon={<Settings />} title="Connect" body="Add Gumroad, Stan Store, Whop, or Payhip credentials before publishing." to="/app/settings" cta="Open settings" />
        <RealStep icon={<ShieldCheck />} title="Publish" body="A launch only counts when the provider returns a real live listing URL." to="/app/launch" cta="View ledger" />
      </section>
    </div>
  );
}

function RealStep({ icon, title, body, to, cta }) {
  return (
    <div className="bg-zinc-950 p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center border border-[#FFD600] text-[#FFD600]">
        {icon}
      </div>
      <div className="mb-2 font-heading text-3xl uppercase">{title}</div>
      <p className="mb-5 text-sm text-zinc-300">{body}</p>
      <Link to={to} className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-4 py-2 font-mono text-xs uppercase tracking-widest text-black">
        {cta}
      </Link>
    </div>
  );
}
