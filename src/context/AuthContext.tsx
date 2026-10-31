import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  loginWithEmail,
  registerWithEmail,
  logoutUser,
  resetPassword as sendResetEmail,
} from '../services/auth';
import { getUserProfile } from '../services/userService';
import type { UserProfile } from '../types/user';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<User>;
  register: (name: string, email: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync profile from Firestore
  const loadProfile = async (uid: string) => {
    try {
      const profile = await getUserProfile(uid);
      setUserProfile(profile);
    } catch (err) {
      console.warn('Could not load user profile from Firestore:', err);
    }
  };

  useEffect(() => {
    // Persistent authentication state observer
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (currentUser) {
      await loadProfile(currentUser.uid);
    }
  };

  const login = async (email: string, pass: string) => {
    const user = await loginWithEmail(email, pass);
    await loadProfile(user.uid);
    return user;
  };

  const register = async (name: string, email: string, pass: string) => {
    const user = await registerWithEmail(name, email, pass);
    await loadProfile(user.uid);
    return user;
  };

  const logout = async () => {
    await logoutUser();
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendResetEmail(email);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        login,
        register,
        logout,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

