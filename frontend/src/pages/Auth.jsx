import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { Zap } from "lucide-react";

const HERO =
  "https://images.unsplash.com/photo-1765539160785-e7953620488f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwyfHxjb250ZW50JTIwY3JlYXRvciUyMGRhcmslMjBzdHVkaW98ZW58MHx8fHwxNzc3MjYxODM1fDA&ixlib=rb-4.1.0&q=85";

export default function Auth({ mode }) {
  const isSignup = mode === "signup";
  const { login, signup, forgotPassword, resetPassword } = useAuth();
  const nav = useNavigate();
  const [search] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const refCode = search.get("ref") || localStorage.getItem("filthy_ref") || "";
  const resetToken = search.get("reset") || "";
  const isReset = Boolean(resetToken) && !isSignup;

  useEffect(() => {
    const q = search.get("ref");
    if (q) localStorage.setItem("filthy_ref", q);
  }, [search]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      if (isSignup) {
        await signup(email, password, name, refCode);
        nav("/app", { replace: true });
      } else if (isReset) {
        await resetPassword(resetToken, password);
        setPassword("");
        setInfo("Password reset. Log in with your new password.");
      } else {
        await login(email, password);
        nav("/app", { replace: true });
      }
    } catch (ex) {
      setErr(ex?.response?.data?.detail || "Failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) {
      setErr("Enter your email first.");
      return;
    }
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      await forgotPassword(email);
      setInfo("If that email exists, a reset link is on the way.");
    } catch {
      setInfo("If that email exists, a reset link is on the way.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#09090B] text-white">
      <div className="relative hidden lg:block border-r border-zinc-800">
        <img src={HERO} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#09090B] via-transparent to-[#09090B]/40" />
        <div className="relative h-full p-12 flex flex-col justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="auth-brand">
            <Zap className="w-6 h-6 text-[#FFD600]" strokeWidth={2.5} />
            <span className="font-heading text-3xl">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
          </Link>
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#FFD600] mb-4">
              Field manual
            </div>
            <h2 className="font-heading text-5xl lg:text-6xl uppercase leading-[0.9]">
              "Polish is a luxury.
              <br />
              <span className="text-[#FF3333]">Shipping is the move.</span>"
            </h2>
            <p className="mt-6 text-zinc-400 max-w-md">
              You're three minutes away from a live digital product, a five-platform ad campaign, and listings on
              every storefront that matters.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={submit} className="w-full max-w-md" data-testid="auth-form">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Zap className="w-5 h-5 text-[#FFD600]" strokeWidth={2.5} />
            <span className="font-heading text-2xl">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
          </div>
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">
            {isSignup ? "New filthy operator" : isReset ? "Secure reset" : "Welcome back"}
          </div>
          <h1 className="font-heading text-5xl uppercase mb-2">
            {isSignup ? "Create account" : isReset ? "Reset password" : "Log in"}
          </h1>
          <p className="text-zinc-400 mb-8">
            {isSignup ? "5 free generations. No card." : isReset ? "Set a fresh password." : "Pick up where you left off."}
          </p>

          {err && (
            <div
              className="bg-[#FF3333]/10 border border-[#FF3333] text-[#FF3333] font-mono text-xs uppercase tracking-widest px-4 py-3 mb-4"
              data-testid="auth-error"
            >
              {String(err)}
            </div>
          )}
          {info && (
            <div className="bg-[#FFD600]/10 border border-[#FFD600] text-[#FFD600] font-mono text-xs uppercase tracking-widest px-4 py-3 mb-4">
              {String(info)}
            </div>
          )}

          {isSignup && (
            <Field
              label="Name"
              value={name}
              onChange={setName}
              required
              data-testid="signup-name-input"
              type="text"
              placeholder="alex"
            />
          )}
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            required
            type="email"
            placeholder="you@filthy.ai"
            data-testid="auth-email-input"
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            required
            minLength={6}
            type="password"
            placeholder="********"
            data-testid="auth-password-input"
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#FFD600] text-black font-mono text-sm uppercase tracking-widest py-4 btn-hard disabled:opacity-60"
            data-testid="auth-submit-btn"
          >
            {busy ? "Working..." : isSignup ? "Create account ->" : isReset ? "Reset password ->" : "Log in ->"}
          </button>

          {!isSignup && !isReset && (
            <button
              type="button"
              onClick={forgot}
              className="w-full mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-[#FFD600]"
            >
              Forgot password?
            </button>
          )}

          <div className="mt-6 text-center font-mono text-xs text-zinc-500">
            {isSignup ? (
              <>
                Already have one?{" "}
                <Link to="/login" className="text-white hover:text-[#FFD600]" data-testid="goto-login">
                  log in
                </Link>
              </>
            ) : (
              <>
                No account?{" "}
                <Link to="/signup" className="text-white hover:text-[#FFD600]" data-testid="goto-signup">
                  create one
                </Link>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, ...rest }) {
  return (
    <label className="block mb-4">
      <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-2">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border border-zinc-800 px-4 py-3 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none"
      />
    </label>
  );
}
