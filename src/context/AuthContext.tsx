import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
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
const PROFILE_BACKUP_PREFIX = 'gideon_customer_profile_backup_v1_';

export interface RememberedPortalAccount {
  phone: string;
  email?: string;
  displayName: string;
  countryCode: string;
  lastSignedInAt: string;
}

export type CustomerWithdrawalMethod = 'PayPal';

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
  accountDetailsLocked?: boolean;
  accountDetailsLockedAt?: string;
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
  loginCount?: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

interface PersistedCustomerBackup extends CustomerProfile {
  totpSecretBackup?: string;
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
  getFreshToken: () => Promise<string | null>;
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
  updateCustomerProfileLocal: (
    profile: CustomerProfile,
    options?: { totpSecretBackup?: string; clearTotpSecret?: boolean }
  ) => void;
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

function readLocalProfileBackup(uid: string): PersistedCustomerBackup | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_BACKUP_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.uid ? (parsed as PersistedCustomerBackup) : null;
  } catch {
    return null;
  }
}

function writeLocalProfileBackup(
  profile: CustomerProfile,
  options?: { totpSecretBackup?: string; clearTotpSecret?: boolean }
) {
  if (!profile?.uid) return;
  try {
    const existing = readLocalProfileBackup(profile.uid);
    const nextBackup: PersistedCustomerBackup = {
      ...profile,
      ...(options?.clearTotpSecret
        ? { totpSecretBackup: undefined }
        : options?.totpSecretBackup
        ? { totpSecretBackup: options.totpSecretBackup }
        : existing?.totpSecretBackup
        ? { totpSecretBackup: existing.totpSecretBackup }
        : {}),
    };
    localStorage.setItem(`${PROFILE_BACKUP_PREFIX}${profile.uid}`, JSON.stringify(nextBackup));
  } catch {
    // ignore quota errors
  }
}

function sanitizeForFirestore(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = sanitizeForFirestore(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function hasRicherProfileData(
  backup: Partial<PersistedCustomerBackup> | null | undefined,
  serverProfile: CustomerProfile | null | undefined
): boolean {
  if (!backup) return false;
  if (!serverProfile) return true;
  if (backup.phone && !serverProfile.phone) return true;
  if (backup.accountDetailsLocked && !serverProfile.accountDetailsLocked) return true;
  if (backup.withdrawalDetails?.accountDetails && !serverProfile.withdrawalDetails?.accountDetails) return true;
  if (backup.twoFactorEnabled && !serverProfile.twoFactorEnabled) return true;
  if (backup.city && !serverProfile.city) return true;
  if (backup.bio && !serverProfile.bio) return true;
  const bTime = Date.parse(backup.updatedAt || '') || 0;
  const sTime = Date.parse(serverProfile.updatedAt || '') || 0;
  if (bTime > sTime + 1000) return true;
  return false;
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

  const getFreshToken = useCallback(async (): Promise<string | null> => {
    if (auth.currentUser) {
      try {
        const fresh = await auth.currentUser.getIdToken();
        if (fresh) {
          setIdToken(fresh);
          return fresh;
        }
      } catch {
        // fallback to stored token
      }
    }
    return idToken || customerToken || null;
  }, [idToken, customerToken]);

  const persistCustomerToDurableStores = useCallback(
    async (
      profile: CustomerProfile,
      options?: { totpSecretBackup?: string; clearTotpSecret?: boolean }
    ) => {
      if (!profile?.uid) return;
      writeLocalProfileBackup(profile, options);

      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === profile.uid && currentUser.emailVerified) {
        const backup = readLocalProfileBackup(profile.uid);
        const firestorePayload = sanitizeForFirestore({
          uid: profile.uid,
          phone: profile.phone || '',
          phoneLocked: Boolean(profile.phoneLocked),
          phoneVerified: Boolean(profile.phoneVerified),
          accountDetailsLocked: Boolean(profile.accountDetailsLocked),
          accountDetailsLockedAt: profile.accountDetailsLockedAt || undefined,
          countryCode: profile.countryCode || 'KE',
          email: profile.email || currentUser.email || '',
          displayName: profile.displayName || currentUser.displayName || 'Contributor',
          city: profile.city || '',
          bio: profile.bio || '',
          socialHandles: profile.socialHandles || undefined,
          withdrawalDetails: profile.withdrawalDetails || undefined,
          twoFactorEnabled: Boolean(profile.twoFactorEnabled),
          twoFactorMethod: profile.twoFactorMethod || 'none',
          ...(options?.clearTotpSecret
            ? { totpSecretBackup: '' }
            : backup?.totpSecretBackup
            ? { totpSecretBackup: backup.totpSecretBackup }
            : {}),
          createdAt: profile.createdAt || new Date().toISOString(),
          updatedAt: profile.updatedAt || new Date().toISOString(),
        });

        try {
          await setDoc(doc(db, 'customer_accounts', currentUser.uid), firestorePayload, { merge: true });
        } catch (err) {
          if (isPermissionError(err)) {
            console.warn('Firestore customer_accounts write permission deferred:', (err as Error)?.message);
          }
        }

        if (profile.displayName) {
          try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              displayName: profile.displayName.slice(0, 120),
              updatedAt: serverTimestamp(),
            });
          } catch {
            // non-blocking
          }
        }
      }
    },
    []
  );

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
    const tokenToUse = overrideToken || (await getFreshToken());
    if (!tokenToUse) return;
    try {
      const res = await fetch('/api/customer/me', {
        headers: { Authorization: `Bearer ${tokenToUse}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.customer) {
          const serverCustomer = data.customer as CustomerProfile;
          const localBackup = readLocalProfileBackup(serverCustomer.uid);
          if (hasRicherProfileData(localBackup, serverCustomer) && localBackup) {
            const hydrateRes = await fetch('/api/customer/hydrate-sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokenToUse}`,
              },
              body: JSON.stringify({
                displayName: localBackup.displayName,
                phone: localBackup.phone,
                phoneLocked: localBackup.phoneLocked,
                phoneVerified: localBackup.phoneVerified,
                accountDetailsLocked: localBackup.accountDetailsLocked,
                accountDetailsLockedAt: localBackup.accountDetailsLockedAt,
                countryCode: localBackup.countryCode,
                city: localBackup.city,
                bio: localBackup.bio,
                socialHandles: localBackup.socialHandles,
                withdrawalDetails: localBackup.withdrawalDetails,
                twoFactorEnabled: localBackup.twoFactorEnabled,
                twoFactorMethod: localBackup.twoFactorMethod,
                totpSecret: localBackup.totpSecretBackup || undefined,
                updatedAt: localBackup.updatedAt,
              }),
            });
            if (hydrateRes.ok) {
              const hData = await hydrateRes.json();
              if (hData?.customer) {
                setCustomerProfile(hData.customer);
                writeLocalProfileBackup(hData.customer);
                return;
              }
            }
          }
          setCustomerProfile(serverCustomer);
          writeLocalProfileBackup(serverCustomer);
        }
      } else if (res.status === 401 && !auth.currentUser) {
        try {
          localStorage.removeItem(CUSTOMER_TOKEN_STORAGE_KEY);
        } catch {}
        setCustomerToken(null);
        setCustomerProfile(null);
      }
    } catch {
      // Non-blocking network fallback
    }
  }, [getFreshToken]);

  useEffect(() => {
    if (customerToken && !user) {
      void refreshCustomerProfile(customerToken);
    }
  }, [customerToken, user, refreshCustomerProfile]);

  useEffect(() => {
    const syncFirestoreProfile = async (currentUser: User): Promise<string | null> => {
      if (!currentUser.emailVerified || !currentUser.email) return null;
      const userPath = `users/${currentUser.uid}`;
      const userRef = doc(db, 'users', currentUser.uid);
      const fallbackName = currentUser.email.split('@')[0] || 'Contributor';
      const cleanName = (currentUser.displayName || fallbackName).trim().slice(0, 120) || 'Contributor';
      let savedCustomName: string | null = null;

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
          savedCustomName = cleanName;
        } else {
          // NEVER overwrite user's saved displayName with Google's displayName on reload
          const existingData = snap.data();
          savedCustomName = existingData?.displayName ? String(existingData.displayName) : cleanName;
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
      return savedCustomName;
    };

    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          setIdToken(token);

          // Immediately show local backup if available while async server/Firestore merge completes
          const cachedBackup = readLocalProfileBackup(currentUser.uid);
          if (cachedBackup) {
            setCustomerProfile((prev) => prev || cachedBackup);
          }

          const [savedUserDocName, firestoreAcctSnap] = await Promise.all([
            syncFirestoreProfile(currentUser),
            currentUser.emailVerified
              ? getDoc(doc(db, 'customer_accounts', currentUser.uid)).catch(() => null)
              : Promise.resolve(null),
          ]);

          const firestoreAcct = firestoreAcctSnap && firestoreAcctSnap.exists()
            ? (firestoreAcctSnap.data() as Partial<PersistedCustomerBackup>)
            : null;

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
              displayName: firestoreAcct?.displayName || cachedBackup?.displayName || savedUserDocName || currentUser.displayName,
              countryCode: firestoreAcct?.countryCode || cachedBackup?.countryCode || savedCountry || undefined
            })
          }).catch((err) => console.warn('Database user sync deferred (network):', err));

          // Fetch server profile & merge with Firestore + localStorage durable backup (Prevents Admin/User Reset!)
          try {
            const meRes = await fetch('/api/customer/me', {
              headers: { Authorization: `Bearer ${token}` }
            });
            const meData = meRes.ok ? await meRes.json() : null;
            let resolvedCustomer: CustomerProfile | null = meData?.customer || null;

            const fsUpdated = Date.parse(firestoreAcct?.updatedAt || '') || 0;
            const cacheUpdated = Date.parse(cachedBackup?.updatedAt || '') || 0;
            const preferredBackup: Partial<PersistedCustomerBackup> | null =
              firestoreAcct && fsUpdated >= cacheUpdated
                ? { ...(cachedBackup || {}), ...firestoreAcct }
                : cachedBackup
                ? { ...(firestoreAcct || {}), ...cachedBackup }
                : null;

            if (preferredBackup && hasRicherProfileData(preferredBackup, resolvedCustomer)) {
              const hydrateRes = await fetch('/api/customer/hydrate-sync', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  displayName: preferredBackup.displayName || savedUserDocName || undefined,
                  phone: preferredBackup.phone,
                  phoneLocked: preferredBackup.phoneLocked,
                  phoneVerified: preferredBackup.phoneVerified,
                  accountDetailsLocked: preferredBackup.accountDetailsLocked,
                  accountDetailsLockedAt: preferredBackup.accountDetailsLockedAt,
                  countryCode: preferredBackup.countryCode,
                  city: preferredBackup.city,
                  bio: preferredBackup.bio,
                  socialHandles: preferredBackup.socialHandles,
                  withdrawalDetails: preferredBackup.withdrawalDetails,
                  twoFactorEnabled: preferredBackup.twoFactorEnabled,
                  twoFactorMethod: preferredBackup.twoFactorMethod,
                  totpSecret: preferredBackup.totpSecretBackup || undefined,
                  updatedAt: preferredBackup.updatedAt,
                }),
              });
              if (hydrateRes.ok) {
                const hData = await hydrateRes.json();
                if (hData?.customer) {
                  resolvedCustomer = hData.customer;
                }
              }
            }

            if (resolvedCustomer) {
              setCustomerProfile(resolvedCustomer);
              void persistCustomerToDurableStores(resolvedCustomer, {
                totpSecretBackup: preferredBackup?.totpSecretBackup,
              });
            }
          } catch {
            // fallback already set from cachedBackup if present
          }
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
  }, [persistCustomerToDurableStores]);

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
      if (data.customer) {
        writeLocalProfileBackup(data.customer);
        if (rememberMe) saveRememberedFromProfile(data.customer);
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
      if (data.customer) {
        writeLocalProfileBackup(data.customer);
        if (rememberMe) {
          saveRememberedFromProfile(data.customer);
        } else {
          clearRememberedAccount();
        }
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
      if (data.customer) {
        writeLocalProfileBackup(data.customer);
        if (rememberMe) saveRememberedFromProfile(data.customer);
      }
      setAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error during 2FA verification.' };
    }
  };

  const updateCustomerProfile: AuthContextType['updateCustomerProfile'] = async (payload) => {
    const tokenToUse = await getFreshToken();
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
        void persistCustomerToDurableStores(data.customer);
        if (rememberedAccount) {
          saveRememberedFromProfile(data.customer);
        }
      }
      return {
        success: true,
        message: data.message || 'Profile updated and saved.',
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error updating profile.' };
    }
  };

  const updateCustomerProfileLocal: AuthContextType['updateCustomerProfileLocal'] = (profile, options) => {
    setCustomerProfile(profile);
    void persistCustomerToDurableStores(profile, options);
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
        getFreshToken,
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
