import { useEffect, useState } from "react";
import api from "../api";
import { CreditCard, Download, Loader2, RefreshCcw, XCircle, ArrowUpDown, ExternalLink } from "lucide-react";
import { useAuth } from "../auth";

const PLANS = ["starter", "pro", "enterprise"];

export default function Billing() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [methods, setMethods] = useState([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = async () => {
    const [i, m] = await Promise.all([api.get("/billing/invoices"), api.get("/billing/payment-methods")]);
    setInvoices(i.data.invoices || []);
    setMethods(m.data.payment_methods || []);
  };

  useEffect(() => { load(); }, []);

  const portal = async () => {
    setBusy("portal");
    try {
      const r = await api.get("/billing/portal");
      window.location.href = r.data.url;
    } catch {
      setMsg("No billing portal yet. Upgrade first to create a Stripe customer.");
      setBusy("");
    }
  };

  const changePlan = async (plan) => {
    setBusy(plan);
    setMsg("");
    try {
      if (user?.subscription_status === "active" || user?.subscription_status === "cancel_scheduled") {
        await api.post("/billing/change-plan", { plan });
        setMsg(`Plan changed to ${plan}.`);
      } else {
        const r = await api.post("/billing/create-checkout", {
          plan,
          origin_url: window.location.origin,
          coupon_code: plan === "starter" ? "STARTER50" : undefined,
        });
        window.location.href = r.data.url;
        return;
      }
    } catch (ex) {
      setMsg(ex?.response?.data?.detail || "Plan change failed.");
    }
    setBusy("");
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      await api.post("/billing/cancel", { at_period_end: true });
      setMsg("Cancellation scheduled for period end.");
    } catch (ex) {
      setMsg(ex?.response?.data?.detail || "Cancel failed.");
    }
    setBusy("");
  };

  const reactivate = async () => {
    setBusy("reactivate");
    try {
      await api.post("/billing/reactivate");
      setMsg("Subscription reactivated.");
    } catch (ex) {
      setMsg(ex?.response?.data?.detail || "Reactivate failed.");
    }
    setBusy("");
  };

  const downloadReceipt = async (invoiceId) => {
    const r = await api.get(`/billing/receipts/${invoiceId}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${invoiceId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 lg:p-12" data-testid="billing-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">Billing UX</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-10">Invoices & plan</h1>

      {msg && <div className="mb-6 border border-[#FFD600] bg-[#FFD600]/10 px-4 py-3 font-mono text-xs uppercase tracking-widest text-[#FFD600]">{msg}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800 mb-10">
        <section className="bg-zinc-950 p-6 xl:col-span-2">
          <div className="font-mono text-xs uppercase tracking-widest mb-4">Upgrade / downgrade</div>
          <div className="grid sm:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800">
            {PLANS.map((plan) => (
              <button key={plan} onClick={() => changePlan(plan)} disabled={busy === plan} className={`bg-zinc-950 p-5 text-left hover:bg-zinc-900 ${user?.plan === plan ? "outline outline-1 outline-[#FFD600]" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-heading text-3xl uppercase">{plan}</span>
                  {busy === plan ? <Loader2 className="w-4 h-4 animate-spin text-[#FFD600]" /> : <ArrowUpDown className="w-4 h-4 text-zinc-500" />}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-2">{user?.plan === plan ? "Current plan" : "Switch plan"}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-5 flex-wrap">
            <button onClick={() => setCancelOpen(true)} disabled={busy === "cancel"} className="border border-[#FF3333] text-[#FF3333] font-mono text-xs uppercase tracking-widest px-4 py-2 hover:bg-[#FF3333] hover:text-white flex items-center gap-2">
              <XCircle className="w-4 h-4" /> Cancel
            </button>
            <button onClick={reactivate} disabled={busy === "reactivate"} className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard flex items-center gap-2">
              <RefreshCcw className="w-4 h-4" /> Reactivate
            </button>
          </div>
          {cancelOpen && (
            <div className="mt-5 border border-[#FF3333] bg-[#FF3333]/10 p-4">
              <div className="font-heading text-2xl uppercase mb-2">Before you cancel</div>
              <div className="text-zinc-300 text-sm mb-4">You can downgrade, reactivate later, or keep access until the current billing period ends.</div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => changePlan("starter")} className="bg-[#FFD600] text-black font-mono text-[10px] uppercase tracking-widest px-3 py-2">Downgrade</button>
                <button onClick={cancel} className="border border-[#FF3333] text-[#FF3333] font-mono text-[10px] uppercase tracking-widest px-3 py-2">Confirm cancel</button>
                <button onClick={() => setCancelOpen(false)} className="border border-zinc-700 text-white font-mono text-[10px] uppercase tracking-widest px-3 py-2">Keep plan</button>
              </div>
            </div>
          )}
        </section>

        <section className="bg-zinc-950 p-6">
          <div className="font-mono text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#FFD600]" /> Payment methods</div>
          {methods.length === 0 ? (
            <div className="text-zinc-500 text-sm mb-4">No saved payment method yet.</div>
          ) : methods.map((m) => (
            <div key={m.id} className="border border-zinc-800 p-3 mb-2">
              <div className="font-heading text-xl uppercase">{m.brand} **** {m.last4}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Expires {m.exp_month}/{m.exp_year}</div>
            </div>
          ))}
          <button onClick={portal} disabled={busy === "portal"} className="w-full border border-zinc-700 text-white font-mono text-xs uppercase tracking-widest px-4 py-3 hover:bg-white hover:text-black flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> Manage in Stripe
          </button>
        </section>
      </div>

      <section className="border border-zinc-800 bg-zinc-950">
        <div className="px-6 py-4 border-b border-zinc-800 font-mono text-xs uppercase tracking-widest">Invoices & receipts</div>
        {invoices.length === 0 ? (
          <div className="p-8 text-zinc-500 font-mono text-xs uppercase tracking-widest">No invoices yet.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {invoices.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-heading text-2xl uppercase">{inv.number || inv.id}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{inv.status} - ${inv.amount_paid} {inv.currency}</div>
                </div>
                <button onClick={() => downloadReceipt(inv.id)} className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard flex items-center gap-2">
                  <Download className="w-4 h-4" /> PDF
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
