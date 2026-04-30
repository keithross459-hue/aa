import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth";
import AppLayout from "./components/AppLayout";
import CookieConsent from "./components/CookieConsent";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CampaignsList = lazy(() => import("./pages/CampaignsList"));
const LaunchesList = lazy(() => import("./pages/LaunchesList"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess"));
const Settings = lazy(() => import("./pages/Settings"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Admin = lazy(() => import("./pages/Admin"));
const Billing = lazy(() => import("./pages/Billing"));
const ExecutiveAnalytics = lazy(() => import("./pages/ExecutiveAnalytics"));
const Machine = lazy(() => import("./pages/Machine"));
const Account = lazy(() => import("./pages/Account"));

function PageLoader() {
  return <div className="p-10 font-mono text-zinc-400">Loading...</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/signup" element={<Auth mode="signup" />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/billing/success" element={<BillingSuccess />} />

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductDetail />} />
              <Route path="campaigns" element={<CampaignsList />} />
              <Route path="launch" element={<LaunchesList />} />
              <Route path="settings" element={<Settings />} />
              <Route path="referrals" element={<Referrals />} />
              <Route path="billing" element={<Billing />} />
              <Route path="analytics" element={<ExecutiveAnalytics />} />
              <Route path="machine" element={<Machine />} />
              <Route path="account" element={<Account />} />
              <Route path="admin" element={<Admin />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <CookieConsent />
      </BrowserRouter>
    </AuthProvider>
  );
}
