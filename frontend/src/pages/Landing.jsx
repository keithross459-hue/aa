import { Link } from "react-router-dom";
import { Zap, Rocket, Megaphone, Package, Sparkles, Skull } from "lucide-react";

const HERO =
  "https://images.unsplash.com/photo-1765539160785-e7953620488f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxjb250ZW50JTIwY3JlYXRvciUyMGRhcmslMjBzdHVkaW98ZW58MHx8fHwxNzc3MjYxODM1fDA&ixlib=rb-4.1.0&q=85";

const TEXTURE =
  "https://images.unsplash.com/photo-1768622943825-2416a5584b65?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxncml0dHklMjBjb25jcmV0ZSUyMHRleHR1cmUlMjBkYXJrfGVufDB8fHx8MTc3NzI2MTg0OHww&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#09090B] text-white" data-testid="landing-page">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-brand">
            <Zap className="h-6 w-6 text-[#FFD600]" strokeWidth={2.5} />
            <span className="font-heading text-3xl">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
          </Link>
          <nav className="hidden items-center gap-8 font-mono text-xs uppercase tracking-widest text-zinc-400 md:flex">
            <a href="#what" className="hover:text-white">What</a>
            <a href="#how" className="hover:text-white">How</a>
            <Link to="/pricing" className="hover:text-white" data-testid="nav-pricing">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="font-mono text-xs uppercase tracking-widest text-zinc-300 hover:text-white" data-testid="login-link">
              Log in
            </Link>
            <Link to="/signup" className="btn-hard bg-[#FFD600] px-5 py-3 font-mono text-xs uppercase tracking-widest text-black" data-testid="signup-cta">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <section className="noise relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/60 via-[#09090B]/85 to-[#09090B]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 pb-32 pt-20">
          <div className="col-span-12 lg:col-span-9">
            <div className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600]">
              Build better digital products before you scale
            </div>
            <h1 className="font-heading text-6xl uppercase leading-[0.85] sm:text-7xl lg:text-9xl">
              Build a sellable
              <br />
              product. <span className="text-[#FFD600]">Prove it.</span>
              <br />
              <span className="outline-text">Then automate.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg text-zinc-300">
              FiiLTHY.AI focuses on product quality first: clear buyer, useful deliverable, store-ready copy, cover, promo videos, and real tracking. Automation is the final layer after the product is actually ready to sell.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/signup" className="btn-hard flex items-center gap-2 bg-[#FFD600] px-8 py-5 font-mono text-sm uppercase tracking-widest text-black" data-testid="hero-cta">
                <Rocket className="h-4 w-4" /> Start free
              </Link>
              <Link to="/pricing" className="border border-zinc-700 px-8 py-5 font-mono text-sm uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black" data-testid="how-link">
                Starter $14.50 today
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              <span className="border border-zinc-800 bg-black/40 px-3 py-2">No card to start</span>
              <span className="border border-zinc-800 bg-black/40 px-3 py-2">Secure Stripe checkout</span>
              <span className="border border-zinc-800 bg-black/40 px-3 py-2">Cancel anytime</span>
            </div>
          </div>
          <div className="col-span-3 hidden flex-col items-end justify-end gap-3 lg:flex">
            <HeroMetric label="Product Assets" value="100%" />
            <HeroMetric label="Promo Videos" value="3+" yellow />
            <HeroMetric label="Automation" value="LAST" red />
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-zinc-800 bg-[#09090B] py-6">
        <div className="marquee-track flex gap-12 whitespace-nowrap font-heading text-6xl">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-12 px-6">
              <span className="outline-text">QUALITY</span>
              <span className="text-[#FFD600]">*</span>
              <span>PRODUCT.</span>
              <span className="outline-text">SELLABILITY.</span>
              <span className="text-[#FF3333]">TRACK.</span>
              <span className="text-[#FFD600]">*</span>
              <span className="outline-text">AUTOMATE.</span>
              <span>ONLY AFTER READY.</span>
            </div>
          ))}
        </div>
      </section>

      <section id="what" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600]">The sellability system</div>
        <h2 className="mb-12 font-heading text-5xl uppercase lg:text-7xl">Quality first. Automation last.</h2>

        <div className="grid grid-cols-12 gap-px border border-zinc-800 bg-zinc-800">
          <Feature
            span="col-span-12 lg:col-span-7 row-span-2"
            icon={<Package className="h-8 w-8" />}
            tag="01 / Product Quality"
            title="Build a complete product."
            body="Tell us a niche. Get the buyer, promise, price, outline, sales copy, store description, cover concept, and actual downloadable product bundle."
            highlight="#FF3333"
          />
          <Feature
            span="col-span-12 lg:col-span-5"
            icon={<Megaphone className="h-8 w-8" />}
            tag="02 / Sellability Assets"
            title="Make the offer understandable."
            body="Each product gets store copy, a cover PNG, TikTok hooks, captions, CTAs, scripts, hashtags, and downloadable promo videos for manual posting."
            highlight="#FFD600"
          />
          <Feature
            span="col-span-12 lg:col-span-5"
            icon={<Rocket className="h-8 w-8" />}
            tag="03 / Automation Layer"
            title="Scale only what is real."
            body="Official platform connections, store publishing, tracking, first-result guidance, and winner signals help you automate after the product has substance."
            highlight="#FF3333"
          />
        </div>
      </section>

      <section
        id="how"
        className="relative border-t border-zinc-800 py-24"
        style={{ backgroundImage: `url(${TEXTURE})`, backgroundPosition: "center", backgroundSize: "cover" }}
      >
        <div className="absolute inset-0 bg-[#09090B]/90" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600]">The workflow</div>
          <h2 className="mb-16 max-w-4xl font-heading text-5xl uppercase lg:text-7xl">
            From <span className="text-[#FFD600]">"I have a niche"</span> to a product people can understand and buy.
          </h2>
          <div className="grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 md:grid-cols-3">
            {[
              { n: "01", t: "Pick the buyer", d: "Choose one clear customer and one outcome worth paying for.", icon: <Sparkles /> },
              { n: "02", t: "Complete assets", d: "Download the product, cover, store copy, sales copy, and promo videos.", icon: <Skull /> },
              { n: "03", t: "Launch and learn", d: "Publish manually or through official APIs, track real clicks and sales, then improve.", icon: <Rocket /> },
            ].map((s) => (
              <div key={s.n} className="bg-zinc-950 p-10">
                <div className="mb-6 font-mono text-xs text-zinc-500">{s.n}</div>
                <div className="mb-6 text-[#FFD600]">{s.icon}</div>
                <div className="mb-3 font-heading text-3xl uppercase">{s.t}</div>
                <div className="text-zinc-400">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-800 py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="font-heading text-6xl uppercase leading-[0.9] lg:text-8xl">
            Start free. <span className="text-[#FFD600]">Pay when you want more.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            Build the first product for free. Starter is $14.50 for the first month when you are ready for more launches.
          </p>
          <Link to="/signup" className="btn-hard mt-10 inline-block bg-[#FFD600] px-10 py-5 font-mono text-sm uppercase tracking-widest text-black" data-testid="bottom-cta">
            Build my first product
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          <span>FiiLTHY.AI / 2026</span>
          <span>Quality. Sellability. Launch. Track. Automate.</span>
        </div>
      </footer>
    </div>
  );
}

function HeroMetric({ label, value, yellow, red }) {
  return (
    <div className="w-full border border-zinc-800 bg-zinc-950 p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`font-heading text-5xl ${yellow ? "text-[#FFD600]" : red ? "text-[#FF3333]" : ""}`}>{value}</div>
    </div>
  );
}

function Feature({ span, icon, tag, title, body, highlight }) {
  return (
    <div className={`bg-zinc-950 p-10 ${span}`}>
      <div style={{ color: highlight }} className="mb-8">
        {icon}
      </div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">{tag}</div>
      <h3 className="mb-4 font-heading text-3xl uppercase lg:text-4xl">{title}</h3>
      <p className="max-w-md text-zinc-400">{body}</p>
    </div>
  );
}
