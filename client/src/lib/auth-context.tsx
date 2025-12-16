import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase, getSession, getUser, signOut as supabaseSignOut } from "./supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { User, Organization } from "@shared/schema";
import { apiRequest } from "./queryClient";

interface AuthContextType {
  supabaseUser: SupabaseUser | null;
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncUser = async (supabaseUserId: string, email: string) => {
    try {
      const response = await apiRequest("POST", "/api/auth/sync", {
        supabaseUserId,
        email,
      });
      const data = await response.json();
      setUser(data.user);
      setOrganization(data.organization);
    } catch (error) {
      console.error("Failed to sync user:", error);
    }
  };

  const refreshUser = async () => {
    const { user: currentUser } = await getUser();
    if (currentUser) {
      await syncUser(currentUser.id, currentUser.email || "");
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { session } = await getSession();
        if (session?.user) {
          setSupabaseUser(session.user);
          await syncUser(session.user.id, session.user.email || "");
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setSupabaseUser(session.user);
          await syncUser(session.user.id, session.user.email || "");
        } else if (event === "SIGNED_OUT") {
          setSupabaseUser(null);
          setUser(null);
          setOrganization(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabaseSignOut();
    setSupabaseUser(null);
    setUser(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider
      value={{
        supabaseUser,
        user,
        organization,
        isLoading,
        isAuthenticated: !!supabaseUser && !!user,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
