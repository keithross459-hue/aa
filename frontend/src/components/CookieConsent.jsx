import { useState } from "react";

export default function CookieConsent() {
  const [accepted, setAccepted] = useState(() => localStorage.getItem("filthy_cookie_consent") === "accepted");
  if (accepted) return null;

  const accept = () => {
    localStorage.setItem("filthy_cookie_consent", "accepted");
    setAccepted(true);
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl border border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-zinc-300">
          FiiLTHY uses essential storage plus optional analytics to improve launches, billing, and product quality.
        </div>
        <button onClick={accept} className="bg-[#FFD600] text-black font-mono text-[10px] uppercase tracking-widest px-4 py-2 btn-hard">
          Accept
        </button>
      </div>
    </div>
  );
}
