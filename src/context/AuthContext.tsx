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
const REMEMBERED_ACCOUNT_KEY = 'gideon_remembered_account_v1';

export interface RememberedPortalAccount {
  phone: string;
  email?: string;
  displayName: string;
  countryCode: string;
  lastSignedInAt: string;
}

export type CustomerWithdrawalMethod =
  | 'M-PESA'
  | 'Airtel / MTN MoMo'
  | 'East Africa Bank'
  | 'Wise'
  | 'Crypto USDT';

export interface CustomerWithdrawalDetails {
  method: CustomerWithdrawalMethod;
  accountDetails: string;
  accountHolderName: string;
  locked: boolean;
  lockedAt: string;
}

export interface CustomerSocialHandles {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  whatsapp?: string;
}

export interface CustomerProfile {
  uid: string;
  phone: string;
  phoneLocked?: boolean;
  countryCode: string;
  email?: string;
  displayName: string;
  city?: string;
  bio?: string;
  socialHandles?: CustomerSocialHandles;
  withdrawalDetails?: CustomerWithdrawalDetails;
  role: 'customer';
  twoFactorEnabled: boolean;
  twoFactorMethod: 'none' | 'sms' | 'totp';
  phoneVerified: boolean;
  banned?: boolean;
  bannedReason?: string;
  bannedAt?: string;
  deactivated?: boolean;
  deactivatedReason?: string;
  deactivatedAt?: string;
  adminAssignedPass?: 'free' | 'starter' | 'pro' | 'vip';
  loginCount?: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LoginResult {
  success: boolean;
  requires2FA?: boolean;
  twoFactorMethod?: 'sms' | 'totp';
  challengeToken?: string;
  maskedPhone?: string;
  carrierDelivered?: boolean;
  providerLabel?: string;
  fallbackReason?: string;
  smsDeliveryMode?: string;
  previewCode?: string;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  customerProfile: CustomerProfile | null;
  rememberedAccount: RememberedPortalAccount | null;
  clearRememberedAccount: () => void;
  idToken: string | null;
  activeToken: string | null;
  loading: boolean;
  isOwner: boolean;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  securityModalOpen: boolean;
  setSecurityModalOpen: (open: boolean) => void;
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  profileModalTab: 'details' | 'withdraw';
  setProfileModalTab: (tab: 'details' | 'withdraw') => void;
  openMyAccount: (tab?: 'details' | 'withdraw') => void;
  signInWithGoogle: () => Promise<void>;
  requestRegistrationOtp: (params: {
    phone: string;
    countryCode: string;
    email?: string;
    password: string;
  }) => Promise<{
    success: boolean;
    maskedPhone?: string;
    carrierDelivered?: boolean;
    providerLabel?: string;
    fallbackReason?: string;
    smsDeliveryMode?: string;
    previewCode?: string;
    error?: string;
  }>;
  registerWithPhone: (params: {
    phone: string;
    countryCode: string;
    email?: string;
    displayName?: string;
    city?: string;
    password: string;
    otpCode: string;
    withdrawalMethod?: CustomerWithdrawalMethod;
    withdrawalAccount?: string;
    withdrawalAccountHolder?: string;
    referralCode?: string;
    rememberMe?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  loginWithPhone: (params: {
    identifier?: string;
    phone?: string;
    countryCode: string;
    password: string;
    rememberMe?: boolean;
  }) => Promise<LoginResult>;
  verifyTwoFactorLogin: (
    challengeToken: string,
    code: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  updateCustomerProfile: (params: {
    displayName?: string;
    email?: string;
    city?: string;
    bio?: string;
    socialHandles?: CustomerSocialHandles;
    phone?: string;
    withdrawalMethod?: CustomerWithdrawalMethod;
    withdrawalAccount?: string;
    withdrawalAccountHolder?: string;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  refreshCustomerProfile: (overrideToken?: string) => Promise<void>;
  updateCustomerProfileLocal: (profile: CustomerProfile) => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readRememberedAccount(): RememberedPortalAccount | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.phone || parsed.email)) {
      return parsed as RememberedPortalAccount;
    }
    return null;
  } catch {
    return null;
  }
}

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
  const [rememberedAccount, setRememberedAccount] = useState<RememberedPortalAccount | null>(() =>
    readRememberedAccount()
  );
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState<'details' | 'withdraw'>('details');

  const openMyAccount = useCallback((tab: 'details' | 'withdraw' = 'details') => {
    setProfileModalTab(tab);
    setProfileModalOpen(true);
  }, []);

  // STRICT: Only nigideon36@gmail.com with verified Google email has owner authority
  const isOwner = Boolean(
    user?.email &&
    user.email.toLowerCase() === OWNER_EMAIL &&
    user.emailVerified
  );

  const activeToken = idToken || customerToken;
  const isAuthenticated = Boolean(user || customerProfile);

  const saveRememberedFromProfile = useCallback((profile: CustomerProfile) => {
    if (!profile?.phone && !profile?.email) return;
    const saved: RememberedPortalAccount = {
      phone: profile.phone,
      email: profile.email,
      displayName: profile.displayName,
      countryCode: profile.countryCode || 'KE',
      lastSignedInAt: new Date().toISOString(),
    };
    setRememberedAccount(saved);
    try {
      localStorage.setItem(REMEMBERED_ACCOUNT_KEY, JSON.stringify(saved));
    } catch {}
  }, []);

  const clearRememberedAccount = useCallback(() => {
    setRememberedAccount(null);
    try {
      localStorage.removeItem(REMEMBERED_ACCOUNT_KEY);
    } catch {}
  }, []);

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
        carrierDelivered: Boolean(data.carrierDelivered),
        providerLabel: data.providerLabel,
        fallbackReason: data.fallbackReason,
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
    city,
    password,
    otpCode,
    withdrawalMethod,
    withdrawalAccount,
    withdrawalAccountHolder,
    referralCode,
    rememberMe = true,
  }) => {
    try {
      const pendingRef = (() => {
        try {
          return localStorage.getItem('gideon_pending_ref_code_v1') || '';
        } catch {
          return '';
        }
      })();
      const resolvedRefCode = (referralCode || pendingRef).trim().toUpperCase() || undefined;

      const res = await fetch('/api/customer/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': countryCode,
          'x-ea-verified': 'true',
        },
        body: JSON.stringify({
          phone,
          countryCode,
          email,
          displayName,
          city,
          password,
          otpCode,
          withdrawalMethod,
          withdrawalAccount,
          withdrawalAccountHolder,
          referralCode: resolvedRefCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Registration failed.' };
      }
      try {
        localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, data.token);
        localStorage.removeItem('gideon_pending_ref_code_v1');
      } catch {}
      setCustomerToken(data.token);
      setCustomerProfile(data.customer);
      if (rememberMe && data.customer) {
        saveRememberedFromProfile(data.customer);
      }
      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during registration.' };
    }
  };

  const loginWithPhone: AuthContextType['loginWithPhone'] = async ({
    identifier,
    phone,
    countryCode,
    password,
    rememberMe = true,
  }) => {
    try {
      const loginId = (identifier || phone || '').trim();
      const res = await fetch('/api/customer/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': countryCode,
          'x-ea-verified': 'true',
        },
        body: JSON.stringify({ identifier: loginId, phone: loginId, countryCode, password }),
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
          carrierDelivered: Boolean(data.carrierDelivered),
          providerLabel: data.providerLabel,
          fallbackReason: data.fallbackReason,
          smsDeliveryMode: data.smsDeliveryMode,
          previewCode: data.previewCode,
        };
      }
      try {
        localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, data.token);
      } catch {}
      setCustomerToken(data.token);
      setCustomerProfile(data.customer);
      if (rememberMe && data.customer) {
        saveRememberedFromProfile(data.customer);
      } else if (!rememberMe) {
        clearRememberedAccount();
      }
      setAuthModalOpen(false);
      return { success: true, requires2FA: false };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during sign in.' };
    }
  };

  const verifyTwoFactorLogin: AuthContextType['verifyTwoFactorLogin'] = async (
    challengeToken,
    code,
    rememberMe = true
  ) => {
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
      if (rememberMe && data.customer) {
        saveRememberedFromProfile(data.customer);
      }
      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during 2FA verification.' };
    }
  };

  const updateCustomerProfile: AuthContextType['updateCustomerProfile'] = async (payload) => {
    const tokenToUse = idToken || customerToken;
    if (!tokenToUse) {
      return { success: false, error: 'Please sign in first to update your profile.' };
    }
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenToUse}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Could not update profile.' };
      }
      if (data.customer) {
        setCustomerProfile(data.customer);
        if (rememberedAccount) {
          saveRememberedFromProfile(data.customer);
        }
      }
      return {
        success: true,
        message: data.message || 'Profile updated successfully.',
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error updating profile.' };
    }
  };

  const updateCustomerProfileLocal = (profile: CustomerProfile) => {
    setCustomerProfile(profile);
    if (rememberedAccount) {
      saveRememberedFromProfile(profile);
    }
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
        rememberedAccount,
        clearRememberedAccount,
        idToken,
        activeToken,
        loading,
        isOwner,
        isAuthenticated,
        authModalOpen,
        setAuthModalOpen,
        securityModalOpen,
        setSecurityModalOpen,
        profileModalOpen,
        setProfileModalOpen,
        profileModalTab,
        setProfileModalTab,
        openMyAccount,
        signInWithGoogle,
        requestRegistrationOtp,
        registerWithPhone,
        loginWithPhone,
        verifyTwoFactorLogin,
        updateCustomerProfile,
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
