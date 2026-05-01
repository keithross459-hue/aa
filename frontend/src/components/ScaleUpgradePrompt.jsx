import { Link } from "react-router-dom";
import { ArrowUpRight, Gauge, Rocket, Zap } from "lucide-react";

const COPY = {
  traction: {
    eyebrow: "Scale moment",
    title: "This is working - scale it",
    body: "You have proof now. Upgrade for faster loops, more launches, and more variations while momentum is warm.",
    primary: "Scale this",
  },
  winner: {
    eyebrow: "Winner detected",
    title: "Turn this signal into more products",
    body: "Winning products should not sit still. Unlock more remixing, more content, and faster launch cycles.",
    primary: "Unlock scale",
  },
  batch: {
    eyebrow: "Batch launch",
    title: "Launch 5 at once when you are ready to scale",
    body: "Batch product launches are for paid plans so your best signals can become a portfolio faster.",
    primary: "Unlock batch",
  },
  limit: {
    eyebrow: "Momentum limit",
    title: "This is working - scale it",
    body: "You used the free launch fuel. Upgrade when you want more speed, more remixes, and more launch attempts.",
    primary: "Keep momentum",
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
        <Feature icon={<Zap />} label="Faster cycles" />
        <Feature icon={<Gauge />} label="More remixes" />
        <Feature icon={<ArrowUpRight />} label="Batch launches" />
      </div>
      <Link to="/pricing" className="btn-hard mt-4 inline-flex items-center gap-2 bg-[#FFD600] px-4 py-2 font-mono text-xs uppercase tracking-widest text-black">
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
