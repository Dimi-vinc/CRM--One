import { useEffect, useState } from 'react';
import { Plus, Trash2, ShieldCheck, AlertCircle, UserPlus } from 'lucide-react';
import { PageHeader, Card, Button, Input, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface SuperAdminEmailRow {
  email: string;
  created_at: string;
}

interface ExistingSuperAdmin {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export function SuperAdminTeam() {
  const { profile } = useAuth();
  const [whitelist, setWhitelist] = useState<SuperAdminEmailRow[]>([]);
  const [existing, setExisting] = useState<ExistingSuperAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: wl }, { data: sa }] = await Promise.all([
      supabase.from('super_admin_emails').select('*').order('created_at', { ascending: true }),
      supabase.from('profiles').select('id, email, full_name, created_at').eq('role', 'super_admin').order('created_at', { ascending: true }),
    ]);
    setWhitelist(wl || []);
    setExisting(sa || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) { setError('Adresse email invalide.'); return; }
    setSaving(true);
    setError(null);
    const { data, error: err } = await supabase.from('super_admin_emails').insert({ email }).select().single();
    setSaving(false);
    if (err) { setError(err.message.includes('duplicate') ? 'Cet email est déjà dans la liste.' : err.message); return; }
    setWhitelist(prev => [...prev, data]);
    setNewEmail('');
  };

  const removeEmail = async (email: string) => {
    setWhitelist(prev => prev.filter(w => w.email !== email));
    await supabase.from('super_admin_emails').delete().eq('email', email);
  };

  return (
    <div>
      <PageHeader
        title="Équipe Super Admin"
        subtitle="Gérez qui peut accéder à l'espace Super Admin (staff interne uniquement)"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-coral-50 p-2.5 text-coral-700"><UserPlus size={20} /></div>
            <div>
              <h3 className="font-semibold text-gray-900">Liste blanche</h3>
              <p className="text-sm text-gray-500">Tout compte créé avec l'une de ces adresses reçoit automatiquement le rôle Super Admin à l'inscription.</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="collegue@liafrik.com" className="flex-1" />
            <Button onClick={addEmail} disabled={saving || !newEmail.trim()}><Plus size={16} /> Ajouter</Button>
          </div>
          {error && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}

          <div className="mt-4 divide-y divide-gray-50">
            {loading ? (
              <p className="py-4 text-center text-xs text-gray-400">Chargement…</p>
            ) : whitelist.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">Aucune adresse dans la liste.</p>
            ) : whitelist.map(w => (
              <div key={w.email} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{w.email}</p>
                  <p className="text-xs text-gray-400">Ajouté le {formatDateTime(w.created_at)}</p>
                </div>
                <button onClick={() => removeEmail(w.email)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><ShieldCheck size={20} /></div>
            <div>
              <h3 className="font-semibold text-gray-900">Super Admins actifs</h3>
              <p className="text-sm text-gray-500">Comptes ayant déjà le rôle Super Admin.</p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-gray-50">
            {existing.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.full_name || a.email} {a.id === profile?.id && <Badge color="blue" className="ml-2">Vous</Badge>}</p>
                  <p className="text-xs text-gray-400">{a.email}</p>
                </div>
                <span className="text-xs text-gray-400">depuis {formatDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">Retirer un accès existant se fait en changeant son rôle depuis Tenants ou en contactant le support technique.</p>
        </Card>
      </div>
    </div>
  );
}
