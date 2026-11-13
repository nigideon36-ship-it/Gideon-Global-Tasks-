import React, { createContext, useContext, useState, useEffect } from 'react';
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

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  loading: boolean;
  isOwner: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwner = Boolean(
    user?.email &&
    user.email.toLowerCase() === OWNER_EMAIL &&
    user.emailVerified
  );

  useEffect(() => {
    const syncFirestoreProfile = async (currentUser: User) => {
      if (!currentUser.emailVerified || !currentUser.email) return;
      const userPath = `users/${currentUser.uid}`;
      const userRef = doc(db, 'users', currentUser.uid);
      const cleanName = (currentUser.displayName || currentUser.email.split('@')[0]).slice(0, 120);

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

          // Sync user profile to Firestore (non-blocking)
          syncFirestoreProfile(currentUser);

          // Sync user to PostgreSQL backend
          fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              email: currentUser.email,
              displayName: currentUser.displayName
            })
          }).catch((err) => console.error('Failed to sync user to database:', err));
        } catch (e) {
          console.error('Error fetching ID token:', e);
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
    } catch (error) {
      console.error('Google sign-in error:', error);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setIdToken(null);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, idToken, loading, isOwner, signInWithGoogle, signOutUser }}>
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
