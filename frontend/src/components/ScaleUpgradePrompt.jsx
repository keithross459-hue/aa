import { Link } from "react-router-dom";
import { ArrowUpRight, Gauge, Rocket, Zap } from "lucide-react";

const COPY = {
  traction: {
    eyebrow: "Momentum unlocked",
    title: "Keep going with Starter",
    body: "You have a signal now. Starter gives you more launch loops and remixes without jumping into a big plan. Founder offer: first month is $14.50.",
    primary: "Start Starter - $14.50",
  },
  winner: {
    eyebrow: "Winner detected",
    title: "Turn this signal into another launch",
    body: "Starter unlocks more launch loops so your best signal can become the next product while momentum is warm. Founder offer: first month is $14.50.",
    primary: "Start Starter - $14.50",
  },
  batch: {
    eyebrow: "Batch launch",
    title: "More launches start with Starter",
    body: "Use Starter first for more product attempts, then move to Pro when you are ready for batch launches. Founder offer: first month is $14.50.",
    primary: "Start Starter - $14.50",
  },
  limit: {
    eyebrow: "Momentum limit",
    title: "Keep building for $14.50",
    body: "You used the free launch fuel. Starter is the smallest paid step for more launches, more remixes, and more chances to get a result.",
    primary: "Start Starter - $14.50",
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
