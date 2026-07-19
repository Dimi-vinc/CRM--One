import { Navigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../lib/types';

// Redirect to /login if no session. Optionally restrict to roles.
export function RequireAuth({ children, roles, requireTenant = true }: { children: ReactNode; roles?: Role[]; requireTenant?: boolean }) {
  const { loading, session, profile } = useAuth();
  const loc = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-pulse text-gray-400">Chargement…</div></div>;
  }
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!profile) return <div className="flex h-screen items-center justify-center text-gray-400">Profil en cours de chargement…</div>;

  if (roles && !roles.includes(profile.role)) {
    // role not allowed → bounce to their own home
    return <Navigate to={profile.role === 'super_admin' ? '/super-admin' : '/dashboard'} replace />;
  }

  // super_admin may bypass tenant requirement
  if (requireTenant && profile.role !== 'super_admin' && !profile.tenant_id) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

// If already signed in, send to dashboard/admin/super-admin
export function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">Chargement…</div>;
  if (session && profile) {
    const target = profile.role === 'super_admin' ? '/super-admin' : profile.tenant_id ? '/dashboard' : '/onboarding';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
