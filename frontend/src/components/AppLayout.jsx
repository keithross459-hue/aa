import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { LayoutDashboard, Package, Megaphone, Rocket, LogOut, Zap, Settings as SettingsIcon, Users, Shield, CreditCard, BarChart3, WandSparkles, UserCircle } from "lucide-react";

export default function AppLayout() {
  const { user, logout, loading } = useAuth();
  if (loading) return <div className="p-10 font-mono text-zinc-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const pct = Math.min(100, Math.round((user.generations_used / user.plan_limit) * 100));

  const link = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 border-l-4 font-mono text-sm uppercase tracking-wider transition-colors ${
      isActive
        ? "border-[#FF3333] bg-zinc-900 text-white"
        : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900"
    }`;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#09090B] text-zinc-100">
      <header className="md:hidden border-b border-zinc-800 bg-[#09090B] sticky top-0 z-20">
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#FFD600]" strokeWidth={2.5} />
            <span className="font-heading text-2xl tracking-wide">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
          </Link>
          <button onClick={logout} className="p-2 text-zinc-400 hover:text-[#FF3333]" title="Log out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <nav className="px-2 pb-2 flex gap-1 overflow-x-auto">
          <NavLink to="/app" end className={link}>Dashboard</NavLink>
          <NavLink to="/app/products" className={link}>Builder</NavLink>
          <NavLink to="/app/machine" className={link}>Auto Mode</NavLink>
          <NavLink to="/app/billing" className={link}>Billing</NavLink>
          <NavLink to="/app/referrals" className={link}>Referrals</NavLink>
          <NavLink to="/app/account" className={link}>Account</NavLink>
          {user.role === "admin" && <NavLink to="/app/admin" className={link}>Admin</NavLink>}
        </nav>
      </header>
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-zinc-800 flex-col" data-testid="sidebar">
        <Link
          to="/app"
          className="px-5 py-6 border-b border-zinc-800 flex items-center gap-2"
          data-testid="brand-link"
        >
          <Zap className="w-6 h-6 text-[#FFD600]" strokeWidth={2.5} />
          <span className="font-heading text-3xl tracking-wide">FiiLTHY<span className="text-[#FF3333]">.</span>AI</span>
        </Link>
        <nav className="flex-1 py-4">
          <NavLink to="/app" end className={link} data-testid="nav-dashboard">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </NavLink>
          <NavLink to="/app/products" className={link} data-testid="nav-products">
            <Package className="w-4 h-4" /> Builder
          </NavLink>
          <NavLink to="/app/campaigns" className={link} data-testid="nav-campaigns">
            <Megaphone className="w-4 h-4" /> Ad Campaigns
          </NavLink>
          <NavLink to="/app/launch" className={link} data-testid="nav-launch">
            <Rocket className="w-4 h-4" /> Store Launches
          </NavLink>
          <NavLink to="/app/machine" className={link} data-testid="nav-machine">
            <WandSparkles className="w-4 h-4" /> Auto Mode
          </NavLink>
          <NavLink to="/app/billing" className={link} data-testid="nav-billing">
            <CreditCard className="w-4 h-4" /> Billing
          </NavLink>
          {user.role === "admin" && (
            <NavLink to="/app/analytics" className={link} data-testid="nav-analytics">
              <BarChart3 className="w-4 h-4" /> Analytics
            </NavLink>
          )}
          <NavLink to="/app/settings" className={link} data-testid="nav-settings">
            <SettingsIcon className="w-4 h-4" /> Integrations
          </NavLink>
          <NavLink to="/app/referrals" className={link} data-testid="nav-referrals">
            <Users className="w-4 h-4" /> Referrals
          </NavLink>
          <NavLink to="/app/account" className={link} data-testid="nav-account">
            <UserCircle className="w-4 h-4" /> Account
          </NavLink>
          {user.role === "admin" && (
            <NavLink to="/app/admin" className={link} data-testid="nav-admin">
              <Shield className="w-4 h-4" /> Admin
            </NavLink>
          )}
        </nav>

        {/* Usage */}
        <div className="border-t border-zinc-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Plan</span>
            <span
              className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-[#FFD600] text-black"
              data-testid="plan-badge"
            >
              {user.plan}
            </span>
          </div>
          <div className="h-2 bg-zinc-800 mb-2">
            <div
              className="h-full bg-[#FFD600]"
              style={{ width: `${pct}%` }}
              data-testid="usage-bar"
            />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-zinc-400">
            <span data-testid="usage-text">
              {user.generations_used}/{user.plan_limit} gens
            </span>
            <span>{pct}%</span>
          </div>
          <Link
            to="/pricing"
            className="block mt-3 text-center bg-[#FF3333] text-white font-mono text-xs uppercase tracking-widest py-2 btn-hard btn-hard-red"
            data-testid="upgrade-btn"
          >
            Upgrade
          </Link>
        </div>

        {/* User */}
        <div className="border-t border-zinc-800 p-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-sm truncate" data-testid="user-name">{user.name}</div>
            <div className="font-mono text-[10px] text-zinc-500 truncate">{user.email}</div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-zinc-400 hover:text-[#FF3333]"
            data-testid="logout-btn"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
