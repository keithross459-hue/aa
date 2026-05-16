import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Copy,
  Download,
  Loader,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import api from "../api";

export default function LocalBusiness() {
  const navigate = useNavigate();
  const [step, setStep] = useState("niches"); // niches, service, outreach
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [niches, setNiches] = useState([]);
  const [selectedNiche, setSelectedNiche] = useState(null);
  const [outreach, setOutreach] = useState(null);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState("");

  // Load niches on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/local/niches");
        setNiches(res.data);
      } catch (ex) {
        setError("Failed to load niches");
      }
    })();
  }, []);

  // Load stats
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/local/stats");
        setStats(res.data);
      } catch (ex) {
        // Stats optional
      }
    })();
  }, []);

  const handleNicheSelect = (niche) => {
    setSelectedNiche(niche);
    setStep("service");
  };

  const handleServiceSelect = async (serviceId) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/local/outreach/generate", {
        niche_id: selectedNiche.id,
        service_id: serviceId,
      });
      setOutreach(res.data);
      setStep("outreach");
    } catch (ex) {
      setError(ex.response?.data?.detail || "Failed to generate outreach");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, variantType) => {
    navigator.clipboard.writeText(text);
    setCopied(variantType);
    setTimeout(() => setCopied(""), 2000);
  };

  const downloadVariant = (variant, format) => {
    let content = variant.copy;
    let filename = `${variant.type}.${format}`;

    if (format === "pdf") {
      // Simple PDF generation
      const element = document.createElement("div");
      element.innerHTML = `
        <h1>${variant.title}</h1>
        <p>${variant.copy.replace(/\n/g, "<br>")}</p>
      `;
      const html = element.innerHTML;
      content = html;
    }

    const blob = new Blob([content], {
      type: format === "pdf" ? "application/pdf" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ===== STEP 1: Niche Selection =====
  if (step === "niches") {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-12">
          <h1 className="text-4xl font-bold mb-2">Get Local Business Clients</h1>
          <p className="text-zinc-400 text-lg">
            AI-powered outreach playbooks. Go from zero to first paying client in 48 hours.
          </p>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            <div className="bg-zinc-900 p-4 rounded border border-zinc-800">
              <div className="text-zinc-400 text-sm mb-1">Outreach Sent</div>
              <div className="text-2xl font-bold">{stats.total_sent}</div>
            </div>
            <div className="bg-zinc-900 p-4 rounded border border-zinc-800">
              <div className="text-zinc-400 text-sm mb-1">Replies</div>
              <div className="text-2xl font-bold">
                {stats.total_replied}
                <span className="text-xs text-zinc-500 ml-1">({Math.round(stats.reply_rate * 100)}%)</span>
              </div>
            </div>
            <div className="bg-zinc-900 p-4 rounded border border-zinc-800">
              <div className="text-zinc-400 text-sm mb-1">Closed Deals</div>
              <div className="text-2xl font-bold">{stats.total_closed}</div>
            </div>
            <div className="bg-zinc-900 p-4 rounded border border-zinc-800">
              <div className="text-zinc-400 text-sm mb-1">Revenue</div>
              <div className="text-2xl font-bold">${stats.total_revenue.toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Niche Grid */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Pick Your Niche</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {niches.map((niche) => (
              <button
                key={niche.id}
                onClick={() => handleNicheSelect(niche)}
                className="p-6 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-[#FFD600] rounded cursor-pointer transition text-left"
              >
                <div className="text-4xl mb-2">{niche.icon}</div>
                <h3 className="text-lg font-bold mb-2">{niche.name}</h3>
                <p className="text-sm text-zinc-400 mb-4">{niche.description}</p>
                <div className="flex items-center text-[#FFD600] text-sm font-mono">
                  Select <ArrowRight className="w-4 h-4 ml-2" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== STEP 2: Service Selection =====
  if (step === "service" && selectedNiche) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => {
              setStep("niches");
              setSelectedNiche(null);
            }}
            className="mb-8 text-zinc-400 hover:text-white transition"
          >
            ← Back to niches
          </button>

          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="text-5xl">{selectedNiche.icon}</div>
              <div>
                <h1 className="text-3xl font-bold">{selectedNiche.name}</h1>
                <p className="text-zinc-400">Pick a service to generate outreach copy</p>
              </div>
            </div>
          </div>

          {/* Service Cards */}
          <div className="space-y-3">
            {selectedNiche.services.map((service) => (
              <button
                key={service.id}
                onClick={() => handleServiceSelect(service.id)}
                disabled={loading}
                className="w-full p-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-[#FFD600] rounded cursor-pointer transition text-left disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{service.name}</h3>
                  </div>
                  {loading ? (
                    <Loader className="w-5 h-5 animate-spin text-[#FFD600]" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-zinc-600" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-8 p-4 bg-red-900/20 border border-red-900 rounded flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== STEP 3: Outreach Display =====
  if (step === "outreach" && outreach) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-5xl mx-auto">
          {/* Back Button */}
          <button
            onClick={() => {
              setStep("service");
              setOutreach(null);
            }}
            className="mb-8 text-zinc-400 hover:text-white transition"
          >
            ← Back to services
          </button>

          <div className="mb-12">
            <h1 className="text-3xl font-bold mb-2">Your Outreach Pack</h1>
            <p className="text-zinc-400">
              8 ready-to-send variants. Copy, download, customize, and send to get your first client.
            </p>
          </div>

          {/* Variants Grid */}
          <div className="space-y-6">
            {outreach.variants.map((variant) => (
              <div
                key={variant.type}
                className="p-6 bg-zinc-900 border border-zinc-800 rounded"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{variant.title}</h3>
                    <p className="text-xs text-zinc-500 mt-1 font-mono">{variant.type}</p>
                  </div>
                </div>

                {/* Copy Area */}
                <div className="bg-zinc-950 p-4 rounded mb-4 text-sm whitespace-pre-wrap">
                  {variant.copy}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copyToClipboard(variant.copy, variant.type)}
                    className="flex items-center gap-2 px-3 py-2 bg-[#FFD600] text-black font-mono text-xs uppercase tracking-wider hover:bg-yellow-500 transition"
                  >
                    {copied === variant.type ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => downloadVariant(variant, "txt")}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 font-mono text-xs uppercase tracking-wider transition"
                  >
                    <Download className="w-4 h-4" />
                    TXT
                  </button>

                  <button
                    onClick={() => downloadVariant(variant, "pdf")}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 font-mono text-xs uppercase tracking-wider transition"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>

                  <button
                    onClick={() => handleServiceSelect(outreach.service_id)}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 font-mono text-xs uppercase tracking-wider transition ml-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Next Steps */}
          <div className="mt-12 p-6 bg-zinc-900 border border-zinc-800 rounded">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FFD600]" />
              Next Steps
            </h3>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li>
                <strong>1. Copy the variant</strong> that matches your style
              </li>
              <li>
                <strong>2. Personalize it</strong> with the prospect's name/business
              </li>
              <li>
                <strong>3. Send via DM, Email, or Text</strong> to 10-20 prospects
              </li>
              <li>
                <strong>4. Track replies</strong> and follow up with the interested ones
              </li>
              <li>
                <strong>5. Close the deal</strong> and get paid
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return <div className="p-10 text-white">Loading...</div>;
}
