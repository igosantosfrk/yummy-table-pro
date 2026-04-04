import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'super_admin' | 'tenant_admin' | 'tenant_user';

interface Profile {
  id: string;
  user_id: string;
  tenant_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  tenantId: string | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isTenantAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
        return null;
      }
      
      setProfile(data);
      return data;
    } catch (err) {
      console.error('fetchProfile exception:', err);
      setProfile(null);
      return null;
    }
  };

  const fetchRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error fetching roles:', error);
        setRoles([]);
        return [];
      }
      
      const userRoles = (data || []).map(r => r.role as AppRole);
      setRoles(userRoles);
      return userRoles;
    } catch (err) {
      console.error('fetchRoles exception:', err);
      setRoles([]);
      return [];
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchRoles(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            try {
              await fetchProfile(session.user.id);
              await fetchRoles(session.user.id);
            } catch (err) {
              console.error('Auth state change error:', err);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id)
          .then(() => fetchRoles(session.user.id))
          .catch(err => console.error('Initial session error:', err))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error('getSession error:', err);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      console.error('SignIn error:', err);
      throw err;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
    } catch (err) {
      console.error('SignUp error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
    } catch (err) {
      console.error('SignOut error:', err);
    }
  };

  const isSuperAdmin = roles.includes('super_admin');
  const isTenantAdmin = roles.includes('tenant_admin');
  const tenantId = profile?.tenant_id ?? null;

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, tenantId, loading,
      isSuperAdmin, isTenantAdmin,
      signIn, signUp, signOut, refreshProfile
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
