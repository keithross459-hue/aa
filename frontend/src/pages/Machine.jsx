import { Link } from "react-router-dom";
import { Package, Settings, ShieldCheck, WandSparkles } from "lucide-react";

export default function Machine() {
  return (
    <div className="p-8 lg:p-12" data-testid="machine-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">Final step only</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-6">Automation comes after quality</h1>
      <p className="mb-10 max-w-3xl text-zinc-300">
        FiiLTHY does not scale empty drafts. Build a complete product, review the sellability assets, connect real platforms, then use automation to move faster once the product is ready to be sold.
      </p>

      <section className="grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-4">
        <RealStep icon={<Package />} title="Product quality" body="Review the title, promise, outline, deliverable, price, and customer outcome before anything gets promoted." to="/app/products" cta="Review products" />
        <RealStep icon={<ShieldCheck />} title="Sellability check" body="Use the store description, sales copy, cover, and promo videos to judge whether a buyer can understand the value fast." to="/app/products" cta="Open inventory" />
        <RealStep icon={<Settings />} title="Real platforms" body="Connect Gumroad, Stan Store, Whop, Payhip, Stripe, TikTok, or other providers when you want publishing and posting to run through official APIs." to="/app/settings" cta="Open settings" />
        <RealStep icon={<WandSparkles />} title="Automate last" body="Only scale the product after the assets are complete and the launch path is connected. Automation is the accelerator, not the proof." to="/app/platforms" cta="View platforms" />
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
