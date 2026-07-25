import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Edit2, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Avatar, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { COUNTRIES } from '../../lib/constants';
import type { Contact, Company } from '../../lib/types';

export function Contacts() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company_id: '', country_code: tenant?.country_code || 'CM', city: '' });

  const load = async () => {
    if (!tenant) return;
    const [c, co] = await Promise.all([
      supabase.from('contacts').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('*'),
    ]);
    setItems(c.data || []);
    setCompanies(co.data || []);
  };
  useEffect(() => { load(); }, [tenant]);

  const filtered = items.filter(c => `${c.first_name} ${c.last_name || ''} ${c.email || ''}`.toLowerCase().includes(search.toLowerCase()));
  const companyName = (id?: string | null) => companies.find(c => c.id === id)?.name;

  const save = async () => {
    if (!tenant || !form.first_name.trim()) return;
    if (editing) {
      const { data } = await supabase.from('contacts').update({ ...form, company_id: form.company_id || null }).eq('id', editing.id).select().single();
      if (data) setItems(prev => prev.map(c => c.id === editing.id ? data : c));
    } else {
      const { data } = await supabase.from('contacts').insert({ ...form, tenant_id: tenant.id, company_id: form.company_id || null }).select().single();
      if (data) setItems(prev => [data, ...prev]);
    }
    setModal(false); setEditing(null);
    setForm({ first_name: '', last_name: '', email: '', phone: '', company_id: '', country_code: tenant.country_code, city: '' });
  };

  const edit = (c: Contact) => {
    setEditing(c);
    setForm({ first_name: c.first_name, last_name: c.last_name || '', email: c.email || '', phone: c.phone || '', company_id: c.company_id || '', country_code: c.country_code || 'CM', city: c.city || '' });
    setModal(true);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(c => c.id !== id));
    await supabase.from('contacts').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Contacts" subtitle={`${items.length} contact${items.length > 1 ? 's' : ''}`}
        actions={<Button onClick={() => { setEditing(null); setForm({ first_name: '', last_name: '', email: '', phone: '', company_id: '', country_code: tenant?.country_code || 'CM', city: '' }); setModal(true); }}><Plus size={16} /> Nouveau contact</Button>} />

      <div className="mb-4 relative max-w-md">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
      </div>

      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Building2} title="Aucun contact" description="Ajoutez votre premier contact pour démarrer." action={<Button onClick={() => setModal(true)}><Plus size={16} /> Ajouter</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nom</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">Entreprise</th><th className="px-4 py-3">Pays</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={`${c.first_name} ${c.last_name || ''}`} size={32} />
                      <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{companyName(c.company_id) || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.country_code}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => edit(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Edit2 size={15} /></button>
                      <button onClick={() => remove(c.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le contact' : 'Nouveau contact'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prénom" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            <Input label="Nom" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input label="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Entreprise" value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}>
              <option value="">—</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Pays" value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value })}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </div>
          <Input label="Ville" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={save}>{editing ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
