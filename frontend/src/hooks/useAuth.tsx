import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthSession, User } from '../types/auth';
import { loginApi } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'stockguard_access_token';
const REFRESH_TOKEN_KEY = 'stockguard_refresh_token';
const USER_KEY = 'stockguard_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const logout = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('stockguard_demo_mode');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('stockguard:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('stockguard:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthSession> => {
    const session = await loginApi(email, password);

    localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);

    const userObj: User = {
      id: 0, // Assigned upon fetch or inferred
      name: session.name,
      email: session.email,
      role: session.role,
      warehouse_id: session.warehouse_id,
      created_at: session.created_at,
    };

    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    setToken(session.access_token);
    setUser(userObj);

    return session;
  };

  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

