"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Role, UserProfile } from "./types";

const OWNER_EMAIL = "chillprostx@gmail.com";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function fallbackProfile(user: User): UserProfile {
  const email = (user.email || "").toLowerCase();
  const role: Role = email === OWNER_EMAIL ? "owner" : "technician";
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email || "User",
    role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const ref = doc(db, "Users", nextUser.uid);
      unsubscribeProfile = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            setProfile(fallbackProfile(nextUser));
          } else {
            const data = snap.data() as Partial<UserProfile>;
            const role: Role = ["owner", "office", "technician"].includes(
              data.role || ""
            )
              ? (data.role as Role)
              : fallbackProfile(nextUser).role;
            setProfile({
              uid: nextUser.uid,
              email: nextUser.email || data.email || "",
              displayName: data.displayName || nextUser.email || "User",
              role,
              technicianName: data.technicianName,
            });
          }
          setLoading(false);
        },
        () => {
          setProfile(fallbackProfile(nextUser));
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
