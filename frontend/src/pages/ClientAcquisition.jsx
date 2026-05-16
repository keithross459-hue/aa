import { useMemo, useState } from "react";
import {
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Mail,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Send,
  Star,
  TrendingUp,
} from "lucide-react";

const NICHES = ["HVAC", "roofing", "auto detailing", "med spa", "plumbing", "landscaping", "cleaning", "dentist"];
const SERVICES = [
  "missed-call follow-up system",
  "quote follow-up campaign",
  "review request system",
  "reactivation campaign",
  "Facebook lead follow-up",
  "Google Business Profile posting",
];
const STORAGE_KEY = "local_business_money_tracker";

function safeFileName(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "local-business-playbook";
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function textToPdfBlob(title, text) {
  const lines = [title, "", ...text.split("\n")].slice(0, 44);
  const escaped = lines.map((line) => line.replace(/[()\\]/g, "\\$&"));
  const stream = escaped.map((line, i) => `BT /F1 10 Tf 50 ${760 - i * 16} Td (${line}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  const body = objects.join("\n");
  const pdf = `%PDF-1.4\n${body}\ntrailer << /Root 1 0 R >>\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function buildPlaybook({ niche, city, service }) {
  const business = `${city} ${niche}`;
  const offer = `We install a simple ${service} for ${business} businesses so more missed leads turn into booked jobs within 7 days.`;
  const price = service.includes("review") ? "$497 setup + $197/mo" : "$750 setup + $300/mo";
  const urgency = `${niche} leads usually go cold fast. The fastest follow-up often wins before the cheapest competitor replies.`;
  const guarantee = "If we do not deliver the scripts, follow-up board, and first campaign within 72 hours, you do not pay the setup fee.";
  const cta = "Want me to send the 3-message follow-up map for your business?";

  return {
    offer,
    price,
    urgency,
    guarantee,
    cta,
    assets: [
      {
        id: "cold-dm",
        title: "Cold DM",
        icon: MessageSquare,
        body: `Hey, quick question. Are you currently following up with every missed call and quote request within 5 minutes?\n\nI help ${business} businesses install a ${service} that turns more leads into booked jobs without adding another full-time admin.\n\n${cta}`,
      },
      {
        id: "cold-email",
        title: "Cold Email",
        icon: Mail,
        body: `Subject: Quick follow-up idea for your ${niche} leads\n\nHey,\n\nI noticed many ${city} ${niche} businesses lose money when missed calls, quote requests, or old leads do not get followed up quickly.\n\n${offer}\n\nThe setup includes SMS scripts, email follow-ups, a simple lead board, and review/rebooking prompts.\n\nPricing suggestion: ${price}.\n\n${cta}`,
      },
      {
        id: "missed-call",
        title: "Missed Call Text",
        icon: PhoneCall,
        body: `Sorry we missed you. This is {{business_name}}. What did you need help with today?\n\nReply with a quick note and we can get you a fast answer or quote.`,
      },
      {
        id: "quote-follow-up",
        title: "Quote Follow-Up",
        icon: Send,
        body: `Hey {{first_name}}, just checking in on the quote we sent for {{service}}.\n\nDo you want me to hold a spot this week, or should I follow up later?`,
      },
      {
        id: "review-request",
        title: "Review Request",
        icon: Star,
        body: `Thanks again for choosing us. If everything went well, could you leave a quick review here?\n\n{{review_link}}\n\nIt helps local customers know who to trust.`,
      },
      {
        id: "reactivation",
        title: "Reactivation Campaign",
        icon: RefreshCw,
        body: `Hey {{first_name}}, it has been a while since we helped with {{last_service}}.\n\nWe have a few openings this week. Want us to take another look or send current pricing?`,
      },
      {
        id: "facebook-ad",
        title: "Facebook Ad",
        icon: TrendingUp,
        body: `Still waiting on a ${niche} quote?\n\nGet a fast response from a local ${city} team. Message us today and we will help you understand the next step before the day ends.\n\nCTA: Send Message`,
      },
      {
        id: "gbp-post",
        title: "Google Business Profile Post",
        icon: BriefcaseBusiness,
        body: `Need ${niche} help in ${city}?\n\nWe are responding quickly to quote requests this week. Call or message us today and we will help you get a clear next step.`,
      },
    ],
    deliverables: [
      "Lead follow-up script pack",
      "Missed-call SMS sequence",
      "Quote follow-up email and text sequence",
      "Review request templates",
      "Old lead reactivation campaign",
      "Simple reply tracker",
      "One-page client handoff PDF",
    ],
  };
}

function loadTracker() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export default function ClientAcquisition() {
  const [niche, setNiche] = useState("med spa");
  const [city, setCity] = useState("Dallas");
  const [service, setService] = useState("missed-call follow-up system");
  const [tracker, setTracker] = useState(() => ({
    outreach: 0,
    replies: 0,
    booked: 0,
    closed: 0,
    monthly: 0,
    ...loadTracker(),
  }));
  const [copied, setCopied] = useState("");
  const playbook = useMemo(() => buildPlaybook({ niche, city, service }), [niche, city, service]);

  const saveTracker = (next) => {
    setTracker(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const bump = (key, amount = 1) => {
    const next = { ...tracker, [key]: Math.max(0, Number(tracker[key] || 0) + amount) };
    if (key === "closed") next.monthly = next.closed * 300;
    saveTracker(next);
  };

  const fullText = [
    `LOCAL BUSINESS MONEY PLAYBOOK`,
    `Niche: ${niche}`,
    `City: ${city}`,
    `Service: ${service}`,
    "",
    `Offer: ${playbook.offer}`,
    `Pricing: ${playbook.price}`,
    `Urgency: ${playbook.urgency}`,
    `Guarantee: ${playbook.guarantee}`,
    `CTA: ${playbook.cta}`,
    "",
    ...playbook.assets.flatMap((asset) => [`## ${asset.title}`, asset.body, ""]),
  ].join("\n");

  const exportTxt = () => downloadBlob(`${safeFileName(`${city}-${niche}-${service}`)}.txt`, fullText, "text/plain");
  const exportPdf = () => {
    const blob = textToPdfBlob("Local Business Money Playbook", fullText);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(`${city}-${niche}-${service}`)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-10" data-testid="client-acquisition-page">
      <div className="mb-6">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-[#FFD600]">Client acquisition mode</div>
        <h1 className="font-heading text-5xl uppercase leading-none lg:text-6xl">Get a local client faster</h1>
        <p className="mt-3 max-w-3xl text-zinc-400">
          Pick a niche, pick a service, copy the outreach, deliver the follow-up system, and track replies until a client closes.
        </p>
      </div>

      <section className="mb-6 grid gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-3">
        <SelectBlock label="Niche" value={niche} onChange={setNiche} options={NICHES} />
        <FieldBlock label="City" value={city} onChange={setCity} placeholder="Dallas" />
        <SelectBlock label="Service" value={service} onChange={setService} options={SERVICES} />
      </section>

      <section className="mb-6 border border-[#FFD600] bg-[#FFD600]/10 p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">AI offer generator</div>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div>
            <h2 className="font-heading text-3xl uppercase">{playbook.offer}</h2>
            <p className="mt-2 text-sm text-zinc-300">{playbook.urgency}</p>
            <div className="mt-3 text-sm text-zinc-300">Guarantee: {playbook.guarantee}</div>
          </div>
          <div className="border border-zinc-800 bg-black p-4">
            <div className="font-heading text-4xl uppercase text-[#FFD600]">{playbook.price}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Suggested pricing</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={exportPdf} className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-4 py-3 font-mono text-xs uppercase tracking-widest text-black">
            <Download className="h-3 w-3" /> Download PDF
          </button>
          <button onClick={exportTxt} className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white hover:bg-white hover:text-black">
            <FileText className="h-3 w-3" /> Export TXT
          </button>
        </div>
      </section>

      <section className="mb-6 grid gap-px border border-zinc-800 bg-zinc-800 lg:grid-cols-5">
        <Tracker label="Outreach sent" value={tracker.outreach} onAdd={() => bump("outreach")} />
        <Tracker label="Replies" value={tracker.replies} onAdd={() => bump("replies")} />
        <Tracker label="Booked calls" value={tracker.booked} onAdd={() => bump("booked")} />
        <Tracker label="Closed clients" value={tracker.closed} onAdd={() => bump("closed")} />
        <Tracker label="Est. monthly" value={`$${tracker.monthly}`} onAdd={() => bump("monthly", 300)} />
      </section>

      <div className="mb-6 grid gap-px border border-zinc-800 bg-zinc-800 xl:grid-cols-[1fr_360px]">
        <section className="grid gap-px bg-zinc-800 md:grid-cols-2">
          {playbook.assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              copied={copied}
              onCopy={() => {
                navigator.clipboard.writeText(asset.body).then(() => setCopied(asset.id));
              }}
              onTxt={() => downloadBlob(`${asset.id}.txt`, asset.body, "text/plain")}
              onPdf={() => {
                const blob = textToPdfBlob(asset.title, asset.body);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${asset.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
            />
          ))}
        </section>

        <aside className="bg-zinc-950 p-5">
          <Panel title="Best opportunity today" icon={<TrendingUp className="h-4 w-4" />}>
            <Bullet title="Trending niches" text="Med spas, roofers, HVAC, detailing, and cleaners respond well to missed-call and quote follow-up offers." />
            <Bullet title="Highest converting offer" text="We recover missed leads with 5-minute text/email follow-up and review prompts." />
            <Bullet title="Best angle" text="You are already paying for leads. We help stop them from leaking after they contact you." />
          </Panel>

          <Panel title="Proof system" icon={<Award className="h-4 w-4" />}>
            <Proof label="Demo campaign" value="Missed calls into booked estimates" />
            <Proof label="Before" value="Lead fills form, waits, goes cold" />
            <Proof label="After" value="SMS, email, and quote follow-up same day" />
            <Proof label="Testimonial slot" value="Add client result after first close" />
          </Panel>

          <Panel title="Viral loop" icon={<CheckCircle2 className="h-4 w-4" />}>
            <Bullet title="Referral reward" text="Offer $100 for every local business referral that closes." />
            <Bullet title="Share playbook" text="Send your follow-up playbook to creators, agencies, and local operators." />
            <Bullet title="Leaderboard" text="Track who brings the most closed clients, not vanity signups." />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function SelectBlock({ label, value, onChange, options }) {
  return (
    <label className="bg-zinc-950 p-4">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-zinc-800 bg-black px-3 py-3 font-mono text-sm text-white focus:border-[#FFD600] focus:outline-none">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function FieldBlock({ label, value, onChange, placeholder }) {
  return (
    <label className="bg-zinc-950 p-4">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full border border-zinc-800 bg-black px-3 py-3 font-mono text-sm text-white focus:border-[#FFD600] focus:outline-none" />
    </label>
  );
}

function Tracker({ label, value, onAdd }) {
  return (
    <div className="bg-zinc-950 p-4">
      <div className="font-heading text-4xl uppercase text-[#FFD600]">{value}</div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <button onClick={onAdd} className="w-full border border-zinc-700 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">+ Add</button>
    </div>
  );
}

function AssetCard({ asset, copied, onCopy, onTxt, onPdf }) {
  const Icon = asset.icon;
  return (
    <div className="bg-zinc-950 p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">
        <Icon className="h-4 w-4" /> {asset.title}
      </div>
      <pre className="min-h-40 whitespace-pre-wrap border border-zinc-800 bg-black p-4 text-sm leading-relaxed text-zinc-300">{asset.body}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onCopy} className="btn-hard inline-flex items-center gap-2 bg-[#FFD600] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-black">
          <Copy className="h-3 w-3" /> {copied === asset.id ? "Copied" : "Copy"}
        </button>
        <button onClick={onPdf} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
          <Download className="h-3 w-3" /> PDF
        </button>
        <button onClick={onTxt} className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white hover:bg-white hover:text-black">
          <FileText className="h-3 w-3" /> TXT
        </button>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }) {
  return (
    <div className="mb-5 border border-zinc-800 bg-black p-4">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFD600]">{icon}{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Bullet({ title, text }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</div>
      <div className="text-sm text-zinc-300">{text}</div>
    </div>
  );
}

function Proof({ label, value }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-200">{value}</div>
    </div>
  );
}
