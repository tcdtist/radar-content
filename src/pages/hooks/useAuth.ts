import { useEffect, useState } from 'react';
import {
  AuthUser,
  checkSession,
  getAuthUser,
  isAdmin as checkIsAdmin,
  loginWithEmail as apiLoginWithEmail,
  loginWithGoogleToken,
  loginWithSecret as apiLoginWithSecret,
  logout as apiLogout,
  onAuthChange,
} from '../services/auth';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getAuthUser);
  const [isAdmin, setIsAdmin] = useState<boolean>(checkIsAdmin);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check session with server on initial mount
    checkSession().then(() => {
      setUser(getAuthUser());
      setIsAdmin(checkIsAdmin());
    });

    // Listen to local changes
    const unsubscribe = onAuthChange((newUser) => {
      setUser(newUser);
      setIsAdmin(checkIsAdmin());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      return await apiLoginWithEmail(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithSecret = async (secret: string) => {
    setIsLoading(true);
    try {
      return await apiLoginWithSecret(secret);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      return await loginWithGoogleToken(idToken);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiLogout();
  };

  return {
    user,
    isAdmin,
    isLoading,
    login,
    loginWithSecret,
    loginWithGoogle,
    logout,
  };
}

