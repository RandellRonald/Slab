import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ApiClientError, apiClient, request } from "../../api/client";
import type { AppRole, AuthSessionPayload, CurrentUser } from "../../types/auth";

interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
  phone?: string;
}

interface LoginInput {
  email: string;
  password: string;
  expected_role?: AppRole;
}

type PresentationRole = AppRole;

interface AuthContextValue {
  user: CurrentUser | null;
  role: AppRole | null;
  loading: boolean;
  error: string | null;
  login: (payload: LoginInput) => Promise<CurrentUser>;
  presentationLogin: (role: PresentationRole) => Promise<CurrentUser>;
  register: (payload: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function applySession(payload: AuthSessionPayload) {
  if (payload.access_token) localStorage.setItem("slab_access_token", payload.access_token);
}

function clearStoredSession() {
  localStorage.removeItem("slab_access_token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCurrentUser = useCallback(async () => {
    if (!localStorage.getItem("slab_access_token")) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const currentUser = await request<CurrentUser>(apiClient.get("/auth/me"));
      setUser(currentUser);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearStoredSession();
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Session restoration failed.");
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrentUser();
    return undefined;
  }, [loadCurrentUser]);

  const login = useCallback(async (payload: LoginInput) => {
    setLoading(true);
    setError(null);
    clearStoredSession();
    try {
      const session = await request<AuthSessionPayload>(apiClient.post("/auth/login", payload));
      applySession(session);
      setUser(session.user);
      setError(null);
      return session.user;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const presentationLogin = useCallback(async (role: PresentationRole) => {
    setLoading(true);
    setError(null);
    clearStoredSession();
    try {
      const session = await request<AuthSessionPayload>(apiClient.post("/auth/presentation-login", { role }));
      applySession(session);
      setUser(session.user);
      setError(null);
      return session.user;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterInput) => {
    setLoading(true);
    try {
      const session = await request<AuthSessionPayload>(apiClient.post("/auth/register", payload));
      applySession(session);
      setUser(session.user);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await request<{ logged_out: boolean }>(apiClient.post("/auth/logout"));
    } finally {
      clearStoredSession();
      setUser(null);
      setError(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const refreshToken = localStorage.getItem("slab_access_token");
    if (!refreshToken) {
      return;
    }
    try {
      const session = await request<AuthSessionPayload>(apiClient.post("/auth/refresh", { refresh_token: refreshToken }));
      applySession(session);
      setUser(session.user);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        clearStoredSession();
        setUser(null);
        setError(null);
        return;
      }
      throw err;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      loading,
      error,
      login,
      presentationLogin,
      register,
      logout,
      refresh
    }),
    [error, loading, login, logout, presentationLogin, refresh, register, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
