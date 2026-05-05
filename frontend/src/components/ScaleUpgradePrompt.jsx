import { Link } from "react-router-dom";
import { ArrowUpRight, Gauge, Rocket, Zap } from "lucide-react";

const COPY = {
  traction: {
    eyebrow: "Momentum unlocked",
    title: "Unlock full product packages",
    body: "You have a signal now. Starter unlocks complete product packages, store bundles, covers, promo videos, campaigns, and launch tools. Founder offer: first month is $14.50.",
    primary: "Unlock all - $14.50",
  },
  winner: {
    eyebrow: "Winner detected",
    title: "Turn this signal into better products",
    body: "Starter unlocks full packages so your best signal can become the next complete product while momentum is warm. Founder offer: first month is $14.50.",
    primary: "Unlock all - $14.50",
  },
  batch: {
    eyebrow: "Batch launch",
    title: "More complete products start with Starter",
    body: "Use Starter first for more complete products, then move to Pro when you are ready for higher-volume testing. Founder offer: first month is $14.50.",
    primary: "Unlock all - $14.50",
  },
  limit: {
    eyebrow: "Momentum limit",
    title: "Unlock every full package for $14.50",
    body: "Free previews show the concept. Starter is the smallest paid step for full product files, store bundles, covers, videos, and launch tools.",
    primary: "Unlock all - $14.50",
  },
};

export default function ScaleUpgradePrompt({ trigger = "traction", compact = false, className = "" }) {
  const copy = COPY[trigger] || COPY.traction;

  return (
    <div className={`border border-[#FFD600] bg-[#FFD600]/10 ${compact ? "p-4" : "p-5"} ${className}`} data-testid={`scale-upgrade-${trigger}`}>
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
        <Rocket className="h-3 w-3" /> {copy.eyebrow}
      </div>
      <div className={`${compact ? "text-2xl" : "text-3xl"} font-heading uppercase`}>{copy.title}</div>
      <p className="mt-2 text-sm text-zinc-300">{copy.body}</p>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Feature icon={<Zap />} label="Full bundles" />
        <Feature icon={<Gauge />} label="Better assets" />
        <Feature icon={<ArrowUpRight />} label="Launch tools" />
      </div>
      <Link to="/pricing?checkout=starter" className="btn-hard mt-4 inline-flex items-center gap-2 bg-[#FFD600] px-4 py-2 font-mono text-xs uppercase tracking-widest text-black">
        {copy.primary} <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function Feature({ icon, label }) {
  return (
    <div className="flex items-center gap-2 border border-zinc-800 bg-black px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-300">
      <span className="text-[#FFD600]">{icon}</span>
      {label}
    </div>
  );
}
