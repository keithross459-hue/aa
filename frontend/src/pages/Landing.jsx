import { Link } from "react-router-dom";
import { Zap, Rocket, Megaphone, Package, Sparkles, Skull } from "lucide-react";

const HERO =
  "https://images.unsplash.com/photo-1765539160785-e7953620488f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxjb250ZW50JTIwY3JlYXRvciUyMGRhcmslMjBzdHVkaW98ZW58MHx8fHwxNzc3MjYxODM1fDA&ixlib=rb-4.1.0&q=85";

const TEXTURE =
  "https://images.unsplash.com/photo-1768622943825-2416a5584b65?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxncml0dHklMjBjb25jcmV0ZSUyMHRleHR1cmUlMjBkYXJrfGVufDB8fHx8MTc3NzI2MTg0OHww&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white overflow-x-hidden" data-testid="landing-page">
      {/* Nav */}
      <header className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-brand">
            <Zap className="w-6 h-6 text-[#FFD600]" strokeWidth={2.5} />
            <span className="font-heading text-3xl">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-zinc-400">
            <a href="#what" className="hover:text-white">What</a>
            <a href="#how" className="hover:text-white">How</a>
            <Link to="/pricing" className="hover:text-white" data-testid="nav-pricing">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="font-mono text-xs uppercase tracking-widest text-zinc-300 hover:text-white"
              data-testid="login-link"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="font-mono text-xs uppercase tracking-widest bg-[#FFD600] text-black px-5 py-3 btn-hard"
              data-testid="signup-cta"
            >
              Start Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative noise overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO} alt="" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/60 via-[#09090B]/85 to-[#09090B]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-32 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-9">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600] mb-6">
              ▮ Build, launch, and promote digital products faster
            </div>
            <h1 className="font-heading text-6xl sm:text-7xl lg:text-9xl leading-[0.85] uppercase">
              Build a digital
              <br />
              product. <span className="text-[#FFD600]">Launch it.</span>
              <br />
              <span className="outline-text">Get your first result.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg text-zinc-300 font-body">
              FiiLTHY.AI guides you from niche to product to launch, then gives you TikTok posts, tracking, and the next action to chase your first click or sale.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/signup"
                className="bg-[#FFD600] text-black font-mono text-sm uppercase tracking-widest px-8 py-5 btn-hard flex items-center gap-2"
                data-testid="hero-cta"
              >
                <Rocket className="w-4 h-4" /> Start free
              </Link>
              <Link
                to="/pricing"
                className="border border-zinc-700 text-white font-mono text-sm uppercase tracking-widest px-8 py-5 hover:bg-white hover:text-black transition-colors"
                data-testid="how-link"
              >
                Starter $14.50 today →
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              <span className="border border-zinc-800 bg-black/40 px-3 py-2">No card to start</span>
              <span className="border border-zinc-800 bg-black/40 px-3 py-2">Secure Stripe checkout</span>
              <span className="border border-zinc-800 bg-black/40 px-3 py-2">Cancel anytime</span>
            </div>
          </div>
          <div className="hidden lg:flex col-span-3 flex-col gap-3 items-end justify-end">
            <div className="border border-zinc-800 p-4 w-full bg-zinc-950">
              <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Generations / mo</div>
              <div className="font-heading text-5xl">∞</div>
            </div>
            <div className="border border-zinc-800 p-4 w-full bg-zinc-950">
              <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Stores Wired</div>
              <div className="font-heading text-5xl text-[#FFD600]">7</div>
            </div>
            <div className="border border-zinc-800 p-4 w-full bg-zinc-950">
              <div className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Ad Platforms</div>
              <div className="font-heading text-5xl text-[#FF3333]">5</div>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <section className="border-y border-zinc-800 py-6 overflow-hidden bg-[#09090B]">
        <div className="flex marquee-track whitespace-nowrap font-heading text-6xl gap-12">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-12 px-6">
              <span className="outline-text">BUILD</span>
              <span className="text-[#FFD600]">★</span>
              <span>LAUNCH.</span>
              <span className="outline-text">ADVERTISE.</span>
              <span className="text-[#FF3333]">TRACK.</span>
              <span className="text-[#FFD600]">★</span>
              <span className="outline-text">REPEAT.</span>
              <span>KEEP MOMENTUM.</span>
              <span className="text-[#FFD600]">★</span>
            </div>
          ))}
        </div>
      </section>

      {/* What */}
      <section id="what" className="max-w-7xl mx-auto px-6 py-24">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600] mb-4">▮ The stack</div>
        <h2 className="font-heading text-5xl lg:text-7xl uppercase mb-12">Three weapons, one workflow.</h2>

        <div className="grid grid-cols-12 gap-px bg-zinc-800 border border-zinc-800">
          <Feature
            span="col-span-12 lg:col-span-7 row-span-2"
            icon={<Package className="w-8 h-8" />}
            tag="01 / Product Forge"
            title="Create a sellable product draft."
            body="Tell us a niche. Get a product title, target persona, price, outline, sales copy, and cover concept. Ebooks, courses, Notion templates, prompt packs — your call."
            highlight="#FF3333"
          />
          <Feature
            span="col-span-12 lg:col-span-5"
            icon={<Megaphone className="w-8 h-8" />}
            tag="02 / Campaign Engine"
            title="Traffic content is ready next."
            body="TikTok hooks, captions, CTAs, scripts, hashtags, and promotion steps are shown clearly so you know what to do after launch."
            highlight="#FFD600"
          />
          <Feature
            span="col-span-12 lg:col-span-5"
            icon={<Rocket className="w-8 h-8" />}
            tag="03 / Multi-Store Launch"
            title="Launch, track, and improve."
            body="Gumroad publishing, tracking, first-result guidance, and winner signals help you understand what is happening after launch."
            highlight="#FF3333"
          />
        </div>
      </section>

      {/* How */}
      <section
        id="how"
        className="relative py-24 border-t border-zinc-800"
        style={{ backgroundImage: `url(${TEXTURE})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-[#09090B]/90" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600] mb-4">▮ The drop</div>
          <h2 className="font-heading text-5xl lg:text-7xl uppercase mb-16 max-w-4xl">
            From <span className="text-[#FFD600]">"I have a niche"</span> to a launched product.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800">
            {[
              { n: "01", t: "Pick a niche", d: "Choose one direction and build the first product.", icon: <Sparkles /> },
              { n: "02", t: "Launch it", d: "Publish the product and get a live link.", icon: <Skull /> },
              { n: "03", t: "Promote it", d: "Copy the first post, track clicks, and keep improving.", icon: <Rocket /> },
            ].map((s) => (
              <div key={s.n} className="bg-zinc-950 p-10">
                <div className="font-mono text-xs text-zinc-500 mb-6">{s.n}</div>
                <div className="text-[#FFD600] mb-6">{s.icon}</div>
                <div className="font-heading text-3xl uppercase mb-3">{s.t}</div>
                <div className="text-zinc-400">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-heading text-6xl lg:text-8xl uppercase leading-[0.9]">
            Start free. <span className="text-[#FFD600]">Pay when you want more.</span>
          </h2>
          <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
            Build the first product for free. Starter is $14.50 for the first month when you are ready for more launches.
          </p>
          <Link
            to="/signup"
            className="inline-block mt-10 bg-[#FFD600] text-black font-mono text-sm uppercase tracking-widest px-10 py-5 btn-hard"
            data-testid="bottom-cta"
          >
            Build my first product →
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          <span>© FiiLTHY.AI / 2026</span>
          <span>Build. Launch. Promote. Track.</span>
        </div>
      </footer>
    </div>
  );
}

function Feature({ span, icon, tag, title, body, highlight }) {
  return (
    <div className={`bg-zinc-950 p-10 ${span}`}>
      <div style={{ color: highlight }} className="mb-8">
        {icon}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-3">{tag}</div>
      <h3 className="font-heading text-3xl lg:text-4xl uppercase mb-4">{title}</h3>
      <p className="text-zinc-400 max-w-md">{body}</p>
    </div>
  );
}
