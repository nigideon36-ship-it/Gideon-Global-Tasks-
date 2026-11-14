import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  OperationType,
  handleFirestoreError,
  isPermissionError
} from '../lib/firebase';

export const OWNER_EMAIL = 'nigideon36@gmail.com';
const CUSTOMER_TOKEN_STORAGE_KEY = 'gideon_customer_token_v1';

export interface CustomerProfile {
  uid: string;
  phone: string;
  countryCode: string;
  email?: string;
  displayName: string;
  role: 'customer';
  twoFactorEnabled: boolean;
  twoFactorMethod: 'none' | 'sms' | 'totp';
  phoneVerified: boolean;
  createdAt: string;
}

export interface LoginResult {
  success: boolean;
  requires2FA?: boolean;
  twoFactorMethod?: 'sms' | 'totp';
  challengeToken?: string;
  maskedPhone?: string;
  smsDeliveryMode?: string;
  previewCode?: string;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  customerProfile: CustomerProfile | null;
  idToken: string | null;
  activeToken: string | null;
  loading: boolean;
  isOwner: boolean;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  securityModalOpen: boolean;
  setSecurityModalOpen: (open: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  requestRegistrationOtp: (params: {
    phone: string;
    countryCode: string;
    email?: string;
    password: string;
  }) => Promise<{
    success: boolean;
    maskedPhone?: string;
    smsDeliveryMode?: string;
    previewCode?: string;
    error?: string;
  }>;
  registerWithPhone: (params: {
    phone: string;
    countryCode: string;
    email?: string;
    displayName?: string;
    password: string;
    otpCode: string;
  }) => Promise<{ success: boolean; error?: string }>;
  loginWithPhone: (params: {
    phone: string;
    countryCode: string;
    password: string;
  }) => Promise<LoginResult>;
  verifyTwoFactorLogin: (challengeToken: string, code: string) => Promise<{ success: boolean; error?: string }>;
  refreshCustomerProfile: (overrideToken?: string) => Promise<void>;
  updateCustomerProfileLocal: (profile: CustomerProfile) => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CUSTOMER_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);

  // STRICT: Only nigideon36@gmail.com with verified Google email has owner authority
  const isOwner = Boolean(
    user?.email &&
    user.email.toLowerCase() === OWNER_EMAIL &&
    user.emailVerified
  );

  const activeToken = idToken || customerToken;
  const isAuthenticated = Boolean(user || customerProfile);

  const refreshCustomerProfile = useCallback(async (overrideToken?: string) => {
    const tokenToUse = overrideToken || idToken || customerToken;
    if (!tokenToUse) return;
    try {
      const res = await fetch('/api/customer/me', {
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.customer) {
          setCustomerProfile(data.customer);
        }
      } else if (res.status === 401 && !idToken) {
        // Clear stale mobile token
        try {
          localStorage.removeItem(CUSTOMER_TOKEN_STORAGE_KEY);
        } catch {}
        setCustomerToken(null);
        setCustomerProfile(null);
      }
    } catch {
      // Non-blocking network fallback
    }
  }, [idToken, customerToken]);

  useEffect(() => {
    if (customerToken && !user) {
      void refreshCustomerProfile(customerToken);
    }
  }, [customerToken, user, refreshCustomerProfile]);

  useEffect(() => {
    const syncFirestoreProfile = async (currentUser: User) => {
      if (!currentUser.emailVerified || !currentUser.email) return;
      const userPath = `users/${currentUser.uid}`;
      const userRef = doc(db, 'users', currentUser.uid);
      const fallbackName = currentUser.email.split('@')[0] || 'Contributor';
      const cleanName = (currentUser.displayName || fallbackName).trim().slice(0, 120) || 'Contributor';

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email.slice(0, 200),
            displayName: cleanName,
            role: currentUser.email.toLowerCase() === OWNER_EMAIL ? 'owner' : 'customer',
            balance: 0,
            streakDays: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(userRef, {
            displayName: cleanName,
            updatedAt: serverTimestamp()
          });
        }
      } catch (err) {
        if (isPermissionError(err)) {
          try {
            handleFirestoreError(err, OperationType.WRITE, userPath);
          } catch (loggedErr) {
            console.warn('Firestore permission check:', loggedErr);
          }
        } else {
          console.warn('Firestore user profile sync deferred (network):', (err as any)?.message || err);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);

          syncFirestoreProfile(currentUser);

          const savedCountry = (() => {
            try { return localStorage.getItem('gideon_ea_country_v1') || localStorage.getItem('gideon_ea_country') || ''; } catch { return ''; }
          })();
          fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              ...(savedCountry ? { 'x-ea-country': savedCountry } : {})
            },
            body: JSON.stringify({
              email: currentUser.email,
              displayName: currentUser.displayName,
              countryCode: savedCountry || undefined
            })
          }).catch((err) => console.warn('Database user sync deferred (network):', err));

          // Also load linked 2FA customer security state for Firebase users
          fetch('/api/customer/me', {
            headers: { Authorization: `Bearer ${token}` }
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.customer) setCustomerProfile(data.customer);
            })
            .catch(() => {});
        } catch (e) {
          console.warn('Error fetching ID token:', e);
          setIdToken(null);
        }
      } else {
        setIdToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      setAuthModalOpen(false);
    } catch (error) {
      console.error('Google sign-in error:', error);
    }
  };

  const requestRegistrationOtp: AuthContextType['requestRegistrationOtp'] = async ({
    phone,
    countryCode,
    email,
    password,
  }) => {
    try {
      const res = await fetch('/api/customer/register/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': countryCode,
          'x-ea-verified': 'true',
        },
        body: JSON.stringify({ phone, countryCode, email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Could not send registration SMS OTP.' };
      }
      return {
        success: true,
        maskedPhone: data.maskedPhone,
        smsDeliveryMode: data.smsDeliveryMode,
        previewCode: data.previewCode,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error sending SMS OTP.' };
    }
  };

  const registerWithPhone: AuthContextType['registerWithPhone'] = async ({
    phone,
    countryCode,
    email,
    displayName,
    password,
    otpCode,
  }) => {
    try {
      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': countryCode,
          'x-ea-verified': 'true',
        },
        body: JSON.stringify({ phone, countryCode, email, displayName, password, otpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Registration failed.' };
      }
      try {
        localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, data.token);
      } catch {}
      setCustomerToken(data.token);
      setCustomerProfile(data.customer);
      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during registration.' };
    }
  };

  const loginWithPhone: AuthContextType['loginWithPhone'] = async ({ phone, countryCode, password }) => {
    try {
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': countryCode,
          'x-ea-verified': 'true',
        },
        body: JSON.stringify({ phone, countryCode, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Invalid credentials.' };
      }
      if (data.requires2FA) {
        return {
          success: true,
          requires2FA: true,
          twoFactorMethod: data.twoFactorMethod,
          challengeToken: data.challengeToken,
          maskedPhone: data.maskedPhone,
          smsDeliveryMode: data.smsDeliveryMode,
          previewCode: data.previewCode,
        };
      }
      try {
        localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, data.token);
      } catch {}
      setCustomerToken(data.token);
      setCustomerProfile(data.customer);
      setAuthModalOpen(false);
      return { success: true, requires2FA: false };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during sign in.' };
    }
  };

  const verifyTwoFactorLogin: AuthContextType['verifyTwoFactorLogin'] = async (challengeToken, code) => {
    try {
      const res = await fetch('/api/customer/verify-2fa-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Verification failed.' };
      }
      try {
        localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, data.token);
      } catch {}
      setCustomerToken(data.token);
      setCustomerProfile(data.customer);
      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during 2FA verification.' };
    }
  };

  const updateCustomerProfileLocal = (profile: CustomerProfile) => {
    setCustomerProfile(profile);
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
    try {
      localStorage.removeItem(CUSTOMER_TOKEN_STORAGE_KEY);
    } catch {}
    setUser(null);
    setIdToken(null);
    setCustomerToken(null);
    setCustomerProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customerProfile,
        idToken,
        activeToken,
        loading,
        isOwner,
        isAuthenticated,
        authModalOpen,
        setAuthModalOpen,
        securityModalOpen,
        setSecurityModalOpen,
        signInWithGoogle,
        requestRegistrationOtp,
        registerWithPhone,
        loginWithPhone,
        verifyTwoFactorLogin,
        refreshCustomerProfile,
        updateCustomerProfileLocal,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
