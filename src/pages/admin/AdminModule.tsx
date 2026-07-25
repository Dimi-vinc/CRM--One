import { useEffect, useState } from 'react';
import { UsersRound, Plus, Trash2, Mail, Shield, Edit2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Badge, Avatar, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { type ModuleKey } from '../../lib/constants';
import { formatDate } from '../../lib/utils';
import type { Profile, CustomRole, TenantInvitation } from '../../lib/types';

const PERMISSIONS = ['view', 'create', 'edit', 'delete'] as const;
type Perm = typeof PERMISSIONS[number];

const PERMISSIONABLE_MODULES: ModuleKey[] = ['dashboard','pipeline','contacts','companies','activities','tasks','calendar','forecast','reports','documents','automations','billing'];

export function AdminModule() {
  const { tenant } = useAuth();
  const [tab, setTab] = useState<'team' | 'roles' | 'invitations'>('team');
  const [members, setMembers] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [invitations, setInvitations] = useState<TenantInvitation[]>([]);
  const [roleModal, setRoleModal] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [roleForm, setRoleForm] = useState<{ name: string; description: string; permissions: Record<string, Perm[]> }>({ name: '', description: '', permissions: {} });
  const [inviteForm, setInviteForm] = useState({ email: '', role_id: '' });
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);

  const load = async () => {
    if (!tenant) return;
    const [m, r, i] = await Promise.all([
      supabase.from('profiles').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: true }),
      supabase.from('roles').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: true }),
      supabase.from('tenant_invitations').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
    ]);
    setMembers(m.data || []); setRoles(r.data || []); setInvitations(i.data || []);
  };
  useEffect(() => { load(); }, [tenant]);

  const togglePerm = (mod: ModuleKey, perm: Perm) => {
    setRoleForm(f => {
      const cur = f.permissions[mod] || [];
      const next = cur.includes(perm) ? cur.filter(p => p !== perm) : [...cur, perm];
      return { ...f, permissions: { ...f.permissions, [mod]: next } };
    });
  };

  const saveRole = async () => {
    if (!tenant || !roleForm.name.trim()) return;
    if (editingRole) {
      const { data } = await supabase.from('roles').update({ name: roleForm.name, description: roleForm.description, permissions: roleForm.permissions }).eq('id', editingRole.id).select().single();
      if (data) setRoles(prev => prev.map(r => r.id === editingRole.id ? data : r));
    } else {
      const { data } = await supabase.from('roles').insert({ ...roleForm, tenant_id: tenant.id }).select().single();
      if (data) setRoles(prev => [...prev, data]);
    }
    setRoleModal(false); setEditingRole(null); setRoleForm({ name: '', description: '', permissions: {} });
  };

  const editRole = (r: CustomRole) => {
    setEditingRole(r);
    setRoleForm({ name: r.name, description: r.description || '', permissions: r.permissions || {} });
    setRoleModal(true);
  };

  const removeRole = async (id: string) => {
    setRoles(prev => prev.filter(r => r.id !== id));
    await supabase.from('roles').delete().eq('id', id);
  };

  const sendInvite = async () => {
    if (!tenant || !inviteForm.email.trim()) return;
    const { data } = await supabase.from('tenant_invitations').insert({
      tenant_id: tenant.id, email: inviteForm.email, role_id: inviteForm.role_id || null,
    }).select().single();
    if (data) setInvitations(prev => [data, ...prev]);
    setInviteModal(false); setInviteForm({ email: '', role_id: '' });
  };

  const cancelInvite = async (id: string) => {
    setInvitations(prev => prev.filter(i => i.id !== id));
    await supabase.from('tenant_invitations').delete().eq('id', id);
  };

  const setMemberRole = async (m: Profile, roleId: string | null) => {
    setMembers(prev => prev.map(x => x.id === m.id ? { ...x, role_id: roleId, role: roleId ? 'custom' : 'custom' } : x));
    await supabase.from('profiles').update({ role_id: roleId }).eq('id', m.id);
  };

  const roleName = (id?: string | null) => roles.find(r => r.id === id)?.name || '—';

  return (
    <div>
      <PageHeader title="Espace Admin" subtitle={`Gestion de l'équipe — ${tenant?.name || ''}`}
        actions={tab === 'team' && <Button onClick={() => setInviteModal(true)}><Mail size={16} /> Inviter</Button>} />

      <div className="mb-4 flex gap-2">
        {[{ k: 'team', l: 'Équipe', i: UsersRound }, { k: 'roles', l: 'Rôles & Permissions', i: Shield }, { k: 'invitations', l: 'Invitations', i: Mail }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${tab === t.k ? 'bg-coral-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <t.i size={14} /> {t.l}
          </button>
        ))}
      </div>

      {tab === 'team' && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Membre</th><th className="px-4 py-3">Rôle système</th><th className="px-4 py-3">Rôle personnalisé</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Créé</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={m.full_name || m.email} size={32} /><div><p className="font-medium text-gray-900">{m.full_name || m.email}</p><p className="text-xs text-gray-500">{m.email}</p></div></div></td>
                  <td className="px-4 py-3"><Badge color={m.role === 'admin' ? 'orange' : 'gray'}>{m.role}</Badge></td>
                  <td className="px-4 py-3">
                    {m.role === 'admin' ? '— (Admin)' : (
                      <Select value={m.role_id || ''} onChange={e => setMemberRole(m, e.target.value || null)} className="py-1 text-xs">
                        <option value="">—</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3"><Badge color={m.status === 'active' ? 'green' : 'red'}>{m.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(m.created_at)}</td>
                </tr>
              ))}
              {members.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucun membre</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'roles' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Button onClick={() => { setEditingRole(null); setRoleForm({ name: '', description: '', permissions: {} }); setRoleModal(true); }}><Plus size={16} /> Nouveau rôle</Button>
          </div>
          {roles.length === 0 ? (
            <Card className="p-8"><EmptyState icon={Shield} title="Aucun rôle personnalisé" description="Créez des rôles comme Commercial, Comptable, Support." action={<Button onClick={() => setRoleModal(true)}>Créer un rôle</Button>} /></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {roles.map(r => (
                <Card key={r.id} className="group p-4">
                  <div className="flex items-start justify-between">
                    <div><p className="font-semibold text-gray-900">{r.name}</p><p className="text-xs text-gray-500">{r.description || '—'}</p></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => editRole(r)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><Edit2 size={14} /></button>
                      <button onClick={() => removeRole(r.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(r.permissions || {}).filter(([, p]) => p && p.length > 0).map(([mod, perms]) => (
                      <span key={mod} className="rounded bg-mint-50 px-2 py-0.5 text-[10px] text-mint-700">{mod}: {(perms as string[]).join(', ')}</span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'invitations' && (
        <Card className="divide-y divide-gray-50">
          {invitations.length === 0 && <div className="p-8 text-center text-sm text-gray-400">Aucune invitation en attente.</div>}
          {invitations.map(i => (
            <div key={i.id} className="flex items-center justify-between p-4">
              <div><p className="text-sm font-medium text-gray-900">{i.email}</p><p className="text-xs text-gray-500">Rôle : {roleName(i.role_id)} · {formatDate(i.created_at)}</p></div>
              <div className="flex items-center gap-2">
                <Badge color={i.status === 'pending' ? 'orange' : 'green'}>{i.status}</Badge>
                <button onClick={() => cancelInvite(i.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Role modal with permission matrix */}
      <Modal open={roleModal} onClose={() => setRoleModal(false)} title={editingRole ? 'Modifier le rôle' : 'Nouveau rôle'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nom du rôle" value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="Commercial" />
            <Input label="Description" value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Accès pipeline" />
          </div>
          <div>
            <p className="label">Matrice de permissions par module</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr><th className="px-3 py-2 text-left">Module</th>{PERMISSIONS.map(p => <th key={p} className="px-3 py-2 text-center capitalize">{p}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {PERMISSIONABLE_MODULES.map(mod => (
                    <tr key={mod}>
                      <td className="px-3 py-2 font-medium text-gray-700">{mod}</td>
                      {PERMISSIONS.map(p => {
                        const checked = (roleForm.permissions[mod] || []).includes(p);
                        return (
                          <td key={p} className="px-3 py-2 text-center">
                            <input type="checkbox" checked={checked} onChange={() => togglePerm(mod, p)} className="h-4 w-4 rounded border-gray-300 text-coral-500" />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRoleModal(false)}>Annuler</Button>
            <Button onClick={saveRole}>{editingRole ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="Inviter un membre">
        <div className="space-y-3">
          <Input label="Email" type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} />
          <Select label="Rôle" value={inviteForm.role_id} onChange={e => setInviteForm({ ...inviteForm, role_id: e.target.value })}>
            <option value="">—</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
          <p className="text-xs text-gray-500">Le membre recevra une invitation à rejoindre {tenant?.name}.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setInviteModal(false)}>Annuler</Button>
            <Button onClick={sendInvite}>Envoyer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
