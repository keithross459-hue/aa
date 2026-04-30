import { useState } from "react";
import { useAuth } from "../auth";
import api from "../api";

export default function Account() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [message, setMessage] = useState("");

  const save = async () => {
    setMessage("Profile updates are protected in admin for this build. Billing, integrations, and security settings are live.");
    await refresh();
  };

  const exportData = async () => {
    const [products, referrals] = await Promise.all([api.get("/products"), api.get("/referrals/me")]);
    const blob = new Blob([JSON.stringify({ user, products: products.data, referrals: referrals.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fiilthy-account-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 lg:p-12" data-testid="account-page">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">Account settings</div>
      <h1 className="font-heading text-5xl lg:text-6xl uppercase mb-10">Profile & data</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 max-w-5xl">
        <section className="bg-zinc-950 p-6">
          <div className="font-mono text-xs uppercase tracking-widest mb-4">Profile</div>
          <label className="block mb-4">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent border border-zinc-800 px-3 py-3 text-white focus:border-[#FFD600] focus:outline-none" />
          </label>
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">{user?.email} - {user?.plan}</div>
          <button onClick={save} className="bg-[#FFD600] text-black font-mono text-xs uppercase tracking-widest px-4 py-2 btn-hard">Save</button>
          {message && <div className="mt-3 text-[#FFD600] font-mono text-[10px] uppercase tracking-widest">{message}</div>}
        </section>
        <section className="bg-zinc-950 p-6">
          <div className="font-mono text-xs uppercase tracking-widest mb-4">Privacy & export</div>
          <div className="text-zinc-400 text-sm mb-4">Download your products and referral ledger as a JSON export.</div>
          <button onClick={exportData} className="border border-zinc-700 text-white font-mono text-xs uppercase tracking-widest px-4 py-2 hover:bg-white hover:text-black">Export account data</button>
        </section>
      </div>
    </div>
  );
}
