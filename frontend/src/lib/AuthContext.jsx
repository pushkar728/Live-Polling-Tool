import { createContext, useContext, useState, useCallback } from "react";

// Auth state lives in React context + localStorage. We only store the
// JWT and basic user info client-side - the token itself is what proves
// identity on every subsequent authenticated request (Authorization header),
// so there's no server-side session to manage.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("pulse_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("pulse_user");
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem("pulse_token", newToken);
    localStorage.setItem("pulse_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pulse_token");
    localStorage.removeItem("pulse_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
