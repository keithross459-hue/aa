import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../auth";
import { CheckCircle2, Loader2, XCircle, Zap } from "lucide-react";

export default function BillingSuccess() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [status, setStatus] = useState("polling"); // polling | paid | failed | timeout
  const [plan, setPlan] = useState(null);
  const sessionId = sp.get("session_id");

  useEffect(() => {
    if (!sessionId) {
      setStatus("failed");
      return;
    }
    let attempts = 0;
    const maxAttempts = 8;
    const poll = async () => {
      attempts += 1;
      try {
        const r = await api.get(`/billing/status/${sessionId}`);
        if (r.data.payment_status === "paid") {
          setPlan(r.data.plan);
          setStatus("paid");
          await refresh();
          return;
        }
        if (r.data.status === "expired") {
          setStatus("failed");
          return;
        }
      } catch {
        // ignore and retry
      }
      if (attempts >= maxAttempts) {
        setStatus("timeout");
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();
  }, [sessionId, refresh]);

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex items-center justify-center p-6" data-testid="billing-success-page">
      <div className="max-w-xl w-full border border-zinc-800 bg-zinc-950 p-10">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Zap className="w-5 h-5 text-[#FFD600]" strokeWidth={2.5} />
          <span className="font-heading text-2xl">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
        </Link>
        {status === "polling" && (
          <>
            <Loader2 className="w-10 h-10 text-[#FFD600] animate-spin mb-6" />
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">▮ Processing</div>
            <h1 className="font-heading text-4xl uppercase mb-4">Confirming payment…</h1>
            <p className="text-zinc-400">This usually takes under 10 seconds. Do not close this window.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-[#FFD600] mb-6" />
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Payment confirmed</div>
            <h1 className="font-heading text-5xl uppercase mb-4">You're on {plan} plan.</h1>
            <p className="text-zinc-400 mb-8">Usage reset. Generate freely.</p>
            <button
              onClick={() => nav("/app")}
              className="bg-[#FFD600] text-black font-mono text-sm uppercase tracking-widest px-8 py-4 btn-hard"
              data-testid="back-to-app-btn"
            >
              Back to the app →
            </button>
          </>
        )}
        {(status === "failed" || status === "timeout") && (
          <>
            <XCircle className="w-10 h-10 text-[#FF3333] mb-6" />
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FF3333] mb-2">
              ▮ {status === "timeout" ? "Still processing" : "Something went wrong"}
            </div>
            <h1 className="font-heading text-4xl uppercase mb-4">
              {status === "timeout" ? "Check back in a minute." : "Payment not confirmed."}
            </h1>
            <p className="text-zinc-400 mb-8">
              {status === "timeout"
                ? "Stripe takes longer sometimes. Your plan will update automatically."
                : "Try again or contact support."}
            </p>
            <Link
              to="/pricing"
              className="inline-block border border-zinc-700 text-white font-mono text-sm uppercase tracking-widest px-8 py-4 hover:bg-white hover:text-black transition-colors"
            >
              Back to pricing
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
