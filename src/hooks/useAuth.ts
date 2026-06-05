'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  userId: number;
  username: string;
}

const STORAGE_KEY = 'gomoku-auth-user';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setUser(raw ? JSON.parse(raw) : null);
      } catch { setUser(null); }
      setIsLoaded(true);
    };
    load();
    window.addEventListener('auth-changed', load);
    return () => window.removeEventListener('auth-changed', load);
  }, []);

  const saveUser = (u: AuthUser | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(u);
    window.dispatchEvent(new Event('auth-changed'));
  };

  const register = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        saveUser({ userId: data.userId, username: data.username });
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch {
      return { success: false, error: '서버 연결 오류' };
    }
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        saveUser({ userId: data.userId, username: data.username });
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch {
      return { success: false, error: '서버 연결 오류' };
    }
  }, []);

  const logout = useCallback(() => saveUser(null), []);

  return { user, isLoaded, register, login, logout };
}
