import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Tenant } from '../lib/types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  mfaRequired: boolean;
  // Module-level access permissions for the current user's custom role, if any (null for
  // admin/super_admin, who always have full access; also null while a 'custom' role user's
  // permissions haven't loaded yet, or if they have no role assigned — treated as no access).
  permissions: Record<string, string[]> | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  tenant: null,
  mfaRequired: false,
  permissions: null,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [permissions, setPermissions] = useState<Record<string, string[]> | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const checkMfa = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setMfaRequired(!!data && data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel);
  };

  const loadProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error('profile load error', error);
      setProfile(null);
      setTenant(null);
      setPermissions(null);
      return;
    }
    setProfile(data as Profile | null);
    if (data?.tenant_id) {
      const { data: t } = await supabase.from('tenants').select('*').eq('id', data.tenant_id).maybeSingle();
      setTenant(t as Tenant | null);
    } else {
      setTenant(null);
    }
    // admin/super_admin always have full access — no restriction lookup needed. A 'custom' role
    // user's actual access comes from their assigned role's permissions map; if none is assigned,
    // they get no module access at all (fail closed, not fail open).
    if (data?.role === 'custom' && data?.role_id) {
      const { data: roleRow } = await supabase.from('roles').select('permissions').eq('id', data.role_id).maybeSingle();
      setPermissions((roleRow?.permissions as Record<string, string[]>) || {});
    } else {
      setPermissions(null);
    }
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session?.user) await loadProfile(data.session.user.id);
    await checkMfa();
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        // trigger may run slightly after first fetch; retry once
        if (!profileRef.current) {
          await new Promise(r => setTimeout(r, 400));
          await loadProfile(data.session.user.id);
        }
      }
      await checkMfa();
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        if (sess?.user) await loadProfile(sess.user.id);
        else { setProfile(null); setTenant(null); }
        await checkMfa();
        setLoading(false);
      })();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setTenant(null);
    setPermissions(null);
    setMfaRequired(false);
  };

  const value = useMemo<AuthState>(() => ({
    loading, session, user: session?.user ?? null, profile, tenant, mfaRequired, permissions, refresh, signOut,
  }), [loading, session, profile, tenant, mfaRequired, permissions, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
