import type { Profile } from './types';

export type PermAction = 'view' | 'create' | 'edit' | 'delete';

/**
 * Real module-level access control (not decorative): admin and super_admin always have full
 * access. A 'custom' role user's access comes strictly from their assigned role's permissions
 * map (loaded in AuthContext); if they have no role assigned, or their role lacks the requested
 * permission for this module, access is denied — fails closed, not open.
 *
 * `moduleKey` here refers to the CRM module (e.g. 'contacts', 'deals'/'pipeline') as configured
 * in the Rôles & Permissions editor (Espace Admin), which may not always match the sidebar
 * ModuleKey 1:1 — callers pass whichever key was used when the role was configured.
 */
export function hasModuleAccess(
  profile: Profile | null,
  permissions: Record<string, string[]> | null,
  moduleKey: string,
  action: PermAction = 'view',
): boolean {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'super_admin') return true;
  if (profile.role === 'custom') {
    // No custom role explicitly assigned yet = full access preserved (historical behavior).
    // Restriction only kicks in once an admin assigns a specific role (role_id set).
    if (!profile.role_id) return true;
    if (!permissions) return false; // role_id set but permissions haven't loaded yet — fail closed only while loading
    const modulePerms = permissions[moduleKey] || [];
    return modulePerms.includes(action);
  }
  return false;
}
