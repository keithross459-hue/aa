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
    setUser(r.data.user);
    return r.data.user;
  };

  const signup = async (email, password, name) => {
    const r = await api.post("/auth/signup", { email, password, name });
    localStorage.setItem("filthy_token", r.data.token);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("filthy_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, signup, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
