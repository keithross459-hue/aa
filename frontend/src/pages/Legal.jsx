import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

const UPDATED = "May 5, 2026";

const CONTENT = {
  terms: {
    eyebrow: "Terms",
    title: "Terms of Service",
    intro: "These terms govern use of FiiLTHY.AI, a web app for creating, publishing, and promoting digital products.",
    sections: [
      ["Use of Service", "You may use FiiLTHY.AI to generate product ideas, sales copy, content drafts, launch assets, and tracking links. You are responsible for reviewing and approving anything you publish or sell."],
      ["Accounts", "You must provide accurate account information and keep login credentials secure. We may suspend access for abuse, fraud, spam, unlawful activity, or attempts to manipulate billing, referrals, analytics, or publishing systems."],
      ["Generated Content", "AI-generated content may require editing. You are responsible for ensuring your products, claims, posts, ads, and uploaded materials comply with applicable law and each third-party platform's rules."],
      ["Payments", "Paid plans and purchases may be processed by Stripe, Gumroad, or other connected providers. We do not store raw card numbers. Subscription access may change if payment fails, is refunded, or is cancelled."],
      ["Third-Party Platforms", "Integrations with services such as TikTok, Gumroad, Meta, YouTube, Instagram, and email providers depend on their APIs, review processes, permissions, and uptime. We cannot guarantee approval, reach, views, clicks, or sales."],
      ["Analytics", "Analytics are used to help users evaluate real product performance. Test, fake, or simulated activity should not be treated as business performance."],
      ["No Income Guarantee", "FiiLTHY.AI helps create and promote digital products, but revenue depends on product quality, demand, pricing, traffic, platform rules, and customer behavior. We do not guarantee income."],
      ["Contact", "For support, account, or legal questions, contact stackdigitz@gmail.com."],
    ],
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    intro: "This policy explains how FiiLTHY.AI collects and uses information to operate the product creation, launch, analytics, and promotion workflow.",
    sections: [
      ["Information We Collect", "We may collect account details, billing status, generated product content, launch settings, connected provider configuration, tracking events, support messages, referral activity, and usage logs."],
      ["How We Use Information", "We use information to authenticate users, generate products, publish listings, provide analytics, process billing, send transactional email, secure the service, and improve product workflows."],
      ["Connected Services", "When you connect third-party services such as TikTok, Gumroad, Stripe, Meta, Instagram, YouTube, or SendGrid, we use the credentials or tokens you provide only to perform the requested integration workflow."],
      ["Payments", "Payment information is handled by third-party processors such as Stripe and Gumroad. FiiLTHY.AI does not store raw payment card numbers."],
      ["Analytics and Tracking", "Tracking links may record impressions, clicks, source, content ID, product ID, timestamp, and conversion events so users can evaluate real performance."],
      ["Data Security", "Sensitive integration credentials are encrypted or stored as environment secrets where supported. No internet service can be guaranteed completely secure, but we use reasonable safeguards."],
      ["Data Requests", "Users may request account export or deletion by contacting stackdigitz@gmail.com. Some records may be retained where required for fraud prevention, security, payment, tax, or legal reasons."],
      ["Contact", "For privacy questions, contact stackdigitz@gmail.com."],
    ],
  },
};

export default function Legal({ type }) {
  const page = CONTENT[type] || CONTENT.terms;
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-[#FFD600]" strokeWidth={2.5} />
            <span className="font-heading text-3xl">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
          </Link>
          <Link to="/login" className="font-mono text-xs uppercase tracking-widest text-zinc-300 hover:text-white">Log in</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600]">{page.eyebrow}</div>
        <h1 className="mb-4 font-heading text-6xl uppercase leading-none">{page.title}</h1>
        <div className="mb-10 font-mono text-xs uppercase tracking-widest text-zinc-500">Updated {UPDATED}</div>
        <p className="mb-10 max-w-3xl text-lg text-zinc-300">{page.intro}</p>
        <div className="divide-y divide-zinc-800 border-y border-zinc-800">
          {page.sections.map(([title, body]) => (
            <section key={title} className="grid gap-4 py-7 md:grid-cols-[220px_1fr]">
              <h2 className="font-heading text-2xl uppercase text-[#FFD600]">{title}</h2>
              <p className="text-sm leading-6 text-zinc-300">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
