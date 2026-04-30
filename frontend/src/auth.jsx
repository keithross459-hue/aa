import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("filthy_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
    } catch {
      localStorage.removeItem("filthy_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    localStorage.setItem("filthy_token", r.data.token);
    localStorage.setItem("filthy_user_id", r.data.user.id);
    setUser(r.data.user);
    return r.data.user;
  };

  const signup = async (email, password, name, referralCode) => {
    const r = await api.post("/auth/signup", { email, password, name, referral_code: referralCode || undefined });
    localStorage.setItem("filthy_token", r.data.token);
    localStorage.setItem("filthy_user_id", r.data.user.id);
    setUser(r.data.user);
    localStorage.removeItem("filthy_ref");
    return r.data.user;
  };

  const forgotPassword = async (email) => {
    const r = await api.post("/auth/forgot-password", { email });
    return r.data;
  };

  const resetPassword = async (token, password) => {
    const r = await api.post("/auth/reset-password", { token, password });
    return r.data;
  };

  const logout = () => {
    localStorage.removeItem("filthy_token");
    localStorage.removeItem("filthy_user_id");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, signup, forgotPassword, resetPassword, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
