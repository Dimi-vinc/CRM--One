import { Navigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { SUPER_ADMIN_EMAILS } from '../lib/constants';
import type { Role } from '../lib/types';

// Check if a user is an authorized super admin (role + email whitelist)
function isAuthorizedSuperAdmin(role: Role | undefined, email: string | undefined): boolean {
  return role === 'super_admin' && SUPER_ADMIN_EMAILS.includes((email || '').toLowerCase());
}

// Redirect to /login if no session. Optionally restrict to roles.
export function RequireAuth({ children, roles, requireTenant = true }: { children: ReactNode; roles?: Role[]; requireTenant?: boolean }) {
  const { loading, session, profile } = useAuth();
  const { t } = useLanguage();
  const loc = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-pulse text-gray-400">{t('common.loading')}</div></div>;
  }
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (!profile) return <div className="flex h-screen items-center justify-center text-gray-400">{t('common.profileLoading')}</div>;

  // Super admin email whitelist enforcement: if role is super_admin but email not whitelisted, downgrade
  const canAccessSuperAdmin = isAuthorizedSuperAdmin(profile.role, profile.email);

  if (roles && roles.includes('super_admin') && !canAccessSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={canAccessSuperAdmin ? '/super-admin' : '/dashboard'} replace />;
  }

  // super_admin may bypass tenant requirement
  if (requireTenant && !canAccessSuperAdmin && !profile.tenant_id) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

// If already signed in, send to dashboard/admin/super-admin
export function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">{t('common.loading')}</div>;
  if (session && profile) {
    const canAccessSuperAdmin = isAuthorizedSuperAdmin(profile.role, profile.email);
    const target = canAccessSuperAdmin ? '/super-admin' : profile.tenant_id ? '/dashboard' : '/onboarding';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
