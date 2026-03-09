import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, userAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!authAPI.isLoggedIn()) { setLoading(false); return; }
    try {
      const data = await userAPI.getProfile();
      setUser(data);
    } catch {
      authAPI.clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (credentials) => {
    const data = await authAPI.login(credentials);
    authAPI.setTokens(data.access, data.refresh);
    setUser(data.user);
    return data;
  };

  const register = async (credentials) => {
    const data = await authAPI.register(credentials);
    authAPI.setTokens(data.access, data.refresh);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  const refreshUser = fetchUser;

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);