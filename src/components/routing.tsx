import { Navigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { Role, Tenant } from '../lib/types';

// The security boundary lives in the database (RLS + the anti-privilege-escalation trigger on
// profiles), not in frontend code: role='super_admin' is only ever assigned via the
// super_admin_emails whitelist trigger at signup, or by an existing super admin promoting a
// colleague (both enforced server-side). Checking the DB-backed role here is sufficient and
// correctly supports super admins adding staff without a frontend redeploy.
function isAuthorizedSuperAdmin(role: Role | undefined): boolean {
  return role === 'super_admin';
}

// A tenant is locked out (must pay to continue) once its trial has ended and it has no active
// paid subscription. Super admins never hit this (checked separately by callers).
function isPaymentRequired(tenant: Tenant | null): boolean {
  if (!tenant) return false;
  if (tenant.status === 'active') return false;
  if (!tenant.trial_ends_at) return false;
  return new Date(tenant.trial_ends_at).getTime() < Date.now();
}

// Routes still reachable while payment is required, so the tenant can actually pay / manage their account.
const PAYWALL_ALLOWED_PATHS = new Set(['/billing', '/security']);

// Redirect to /login if no session. Optionally restrict to roles.
export function RequireAuth({ children, roles, requireTenant = true }: { children: ReactNode; roles?: Role[]; requireTenant?: boolean }) {
  const { loading, session, profile, tenant, mfaRequired } = useAuth();
  const { t } = useLanguage();
  const loc = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-pulse text-gray-400">{t('common.loading')}</div></div>;
  }
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;

  // Step-up authentication: block access to anything until the AAL2 (2FA) challenge is completed
  if (mfaRequired && loc.pathname !== '/mfa-challenge') {
    return <Navigate to="/mfa-challenge" state={{ from: loc.pathname }} replace />;
  }

  if (!profile) return <div className="flex h-screen items-center justify-center text-gray-400">{t('common.profileLoading')}</div>;

  // Super admin email whitelist enforcement: if role is super_admin but email not whitelisted, downgrade
  const canAccessSuperAdmin = isAuthorizedSuperAdmin(profile.role);

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

  // Paywall: trial ended + no active subscription = locked out except for /billing (and /security,
  // so 2FA/password management stay reachable). Super admins are never locked out.
  if (!canAccessSuperAdmin && isPaymentRequired(tenant) && !PAYWALL_ALLOWED_PATHS.has(loc.pathname)) {
    return <Navigate to="/billing" replace />;
  }

  return <>{children}</>;
}

// If already signed in, send to dashboard/admin/super-admin (or the pending MFA challenge)
export function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, session, profile, mfaRequired } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">{t('common.loading')}</div>;
  if (session && mfaRequired) return <Navigate to="/mfa-challenge" replace />;
  if (session && profile) {
    const canAccessSuperAdmin = isAuthorizedSuperAdmin(profile.role);
    const target = canAccessSuperAdmin ? '/super-admin' : profile.tenant_id ? '/dashboard' : '/onboarding';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}

// Guards the /mfa-challenge route itself: requires a session, and only makes sense while a step-up is pending
export function RequireMfaPending({ children }: { children: ReactNode }) {
  const { loading, session, mfaRequired } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400">{t('common.loading')}</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!mfaRequired) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
