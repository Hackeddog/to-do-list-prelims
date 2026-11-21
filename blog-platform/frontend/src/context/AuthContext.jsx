import { createContext, useContext, useEffect, useState } from 'react';
import {
  authApi,
  clearTokens,
  decodeJwt,
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  refreshAccessToken,
  setTokens
} from '../api/client';

const AuthContext = createContext(null);

function extractUserFromToken(token) {
  const payload = decodeJwt(token);
  if (!payload || payload.type === 'refresh') return null;
  return {
    id: payload.id,
    username: payload.username,
    email: payload.email,
    role: payload.role
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = getAccessToken();
    const payload = decodeJwt(token);
    return payload && !isTokenExpired(payload) ? extractUserFromToken(token) : null;
  });
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const token = getAccessToken();
      const payload = decodeJwt(token);

      if (token && payload && !isTokenExpired(payload)) {
        if (active) {
          setUser(extractUserFromToken(token));
          setInitializing(false);
        }
        return;
      }

      if (getRefreshToken()) {
        const refreshedToken = await refreshAccessToken();
        if (active) {
          setUser(refreshedToken ? extractUserFromToken(refreshedToken) : null);
        }
      } else if (token) {
        clearTokens();
      }

      if (active) setInitializing(false);
    }

    function handleAuthCleared() {
      setUser(null);
    }

    window.addEventListener('blog-auth-cleared', handleAuthCleared);
    restoreSession();

    return () => {
      active = false;
      window.removeEventListener('blog-auth-cleared', handleAuthCleared);
    };
  }, []);

  async function login(credentials) {
    const data = await authApi.login(credentials);
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    const nextUser = data.user || extractUserFromToken(data.accessToken);
    setUser(nextUser);
    return nextUser;
  }

  async function register(payload) {
    return authApi.register(payload);
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Clear local session even if server already revoked or is unreachable
    } finally {
      clearTokens();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        isAuthenticated: Boolean(user),
        canPublish: user?.role === 'author' || user?.role === 'admin',
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
