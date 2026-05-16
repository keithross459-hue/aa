import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ExternalLink, Megaphone, Package, Target } from "lucide-react";
import { INCOME_STRATEGY } from "../lib/incomeStrategy";

const HERO =
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1800&q=85";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white" data-testid="landing-page">
      <header className="border-b border-zinc-800 bg-[#09090B]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-heading text-3xl uppercase tracking-wide" data-testid="landing-brand">
            Income Launch Desk
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="font-mono text-xs uppercase tracking-widest text-zinc-300 hover:text-white" data-testid="login-link">
              Log in
            </Link>
            <Link to="/signup" className="btn-hard bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black" data-testid="signup-cta">
              Start
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO} alt="" className="h-full w-full object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/55 via-[#09090B]/90 to-[#09090B]" />
        </div>
        <div className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl content-center gap-10 px-6 py-16 lg:grid-cols-[1fr_390px]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 border border-[#FFD600] bg-black/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#FFD600]">
              <Target className="h-3 w-3" /> Best path: local service follow-up scripts
            </div>
            <h1 className="font-heading text-6xl uppercase leading-[0.9] sm:text-7xl lg:text-8xl">
              Get local business clients
              <br />
              <span className="text-[#FFD600]">with AI follow-up systems.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-300">
              Get local business clients using AI-powered follow-up systems and outreach playbooks. Pick a niche, generate offers, send scripts, deliver the system, and track replies until deals close.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/signup" className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-7 py-4 font-mono text-sm uppercase tracking-widest text-black" data-testid="hero-cta">
                Start client mode <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={INCOME_STRATEGY.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-zinc-700 px-7 py-4 font-mono text-sm uppercase tracking-widest text-white hover:bg-white hover:text-black">
                See live offer <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <aside className="border border-zinc-800 bg-black/80 p-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#FFD600]">Recommended first service</div>
            <div className="font-heading text-4xl uppercase">{INCOME_STRATEGY.productTitle}</div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Start by selling this as a done-for-you follow-up system to local businesses. It is easier to explain than a generic AI tool and closer to real client revenue.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-px bg-zinc-800">
              <Mini label="Price" value={`$${INCOME_STRATEGY.price}`} />
              <Mini label="Buyer" value="Local service" />
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-zinc-800 bg-zinc-950">
        <div className="mx-auto grid max-w-7xl gap-px bg-zinc-800 px-6 py-px md:grid-cols-3">
          <Step icon={<Package />} title="Generate" text="Choose niche, city, and service. Get the offer, guarantee, pricing, and outreach scripts." />
          <Step icon={<Megaphone />} title="Send" text="Copy cold DMs, emails, missed-call texts, quote follow-ups, and reactivation campaigns." />
          <Step icon={<CheckCircle2 />} title="Close" text="Track outreach, replies, booked calls, closed clients, and estimated monthly income." />
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-8 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        <span>Income Launch Desk</span>
        <span>No income guarantee. Real proof only.</span>
      </footer>
    </div>
  );
}

function Step({ icon, title, text }) {
  return (
    <div className="bg-[#09090B] p-6">
      <div className="mb-4 text-[#FFD600]">{icon}</div>
      <div className="mb-2 font-heading text-3xl uppercase">{title}</div>
      <p className="text-sm leading-relaxed text-zinc-400">{text}</p>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-zinc-950 p-4">
      <div className="font-heading text-3xl uppercase text-[#FFD600]">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
    </div>
  );
}
