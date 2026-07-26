import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Edit2, Building2, Copy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Badge, EmptyState } from '../../components/ui';
import { DuplicatesModal } from '../../components/DuplicatesModal';
import { supabase } from '../../lib/supabase';
import { COUNTRIES } from '../../lib/constants';
import { findCompanyDuplicates } from '../../lib/dedup';
import type { Company } from '../../lib/types';

const INDUSTRIES = ['Technologie','Finance','Retail',' Santé','Éducation','Logistique','Énergie','Agriculture','Télécom','Autre'];

export function Companies() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [dupModal, setDupModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: '', industry: '', website: '', email: '', phone: '', country_code: tenant?.country_code || 'CM', city: '' });

  const load = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false });
    setItems(data || []);
  };
  useEffect(() => { load(); }, [tenant]);

  const duplicateGroups = useMemo(() => findCompanyDuplicates(items), [items]);
  const filtered = items.filter(c => `${c.name} ${c.industry || ''} ${c.city || ''}`.toLowerCase().includes(search.toLowerCase()));

  const mergeCompanies = async (primaryId: string, duplicateIds: string[]) => {
    const primary = items.find(c => c.id === primaryId);
    const dups = items.filter(c => duplicateIds.includes(c.id));
    if (!primary) return;

    const merged: Partial<Company> = {};
    (['industry', 'website', 'email', 'phone', 'city', 'country_code'] as const).forEach(field => {
      if (!primary[field]) {
        const donor = dups.find(d => d[field]);
        if (donor) merged[field] = donor[field] as never;
      }
    });
    if (Object.keys(merged).length > 0) {
      await supabase.from('companies').update(merged).eq('id', primaryId);
    }
    await Promise.all([
      supabase.from('contacts').update({ company_id: primaryId }).in('company_id', duplicateIds),
      supabase.from('deals').update({ company_id: primaryId }).in('company_id', duplicateIds),
    ]);
    await supabase.from('companies').delete().in('id', duplicateIds);
    await load();
  };

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    if (editing) {
      const { data } = await supabase.from('companies').update(form).eq('id', editing.id).select().single();
      if (data) setItems(prev => prev.map(c => c.id === editing.id ? data : c));
    } else {
      const { data } = await supabase.from('companies').insert({ ...form, tenant_id: tenant.id }).select().single();
      if (data) setItems(prev => [data, ...prev]);
    }
    setModal(false); setEditing(null);
    setForm({ name: '', industry: '', website: '', email: '', phone: '', country_code: tenant.country_code, city: '' });
  };

  const edit = (c: Company) => {
    setEditing(c);
    setForm({ name: c.name, industry: c.industry || '', website: c.website || '', email: c.email || '', phone: c.phone || '', country_code: c.country_code || 'CM', city: c.city || '' });
    setModal(true);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(c => c.id !== id));
    await supabase.from('companies').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Entreprises" subtitle={`${items.length} entreprise${items.length > 1 ? 's' : ''}`}
        actions={(
          <>
            {duplicateGroups.length > 0 && (
              <Button variant="secondary" onClick={() => setDupModal(true)}>
                <Copy size={16} /> {duplicateGroups.length} doublon{duplicateGroups.length > 1 ? 's' : ''}
              </Button>
            )}
            <Button onClick={() => { setEditing(null); setForm({ name: '', industry: '', website: '', email: '', phone: '', country_code: tenant?.country_code || 'CM', city: '' }); setModal(true); }}><Plus size={16} /> Nouvelle entreprise</Button>
          </>
        )} />

      <div className="mb-4 relative max-w-md">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
      </div>

      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Building2} title="Aucune entreprise" description="Ajoutez votre première entreprise." action={<Button onClick={() => setModal(true)}><Plus size={16} /> Ajouter</Button>} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <Card key={c.id} className="group p-4 hover:shadow-cardHover transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><Building2 size={20} /></div>
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.city}, {c.country_code}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => edit(c)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><Edit2 size={14} /></button>
                  <button onClick={() => remove(c.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.industry && <Badge color="blue">{c.industry}</Badge>}
                {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="text-xs text-coral-600 hover:underline">{c.website}</a>}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                {c.email && <p>{c.email}</p>}{c.phone && <p>{c.phone}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}>
        <div className="space-y-3">
          <Input label="Nom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Secteur" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}>
              <option value="">—</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </Select>
            <Input label="Site web" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="acme.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Pays" value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value })}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
            <Input label="Ville" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={save}>{editing ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>

      <DuplicatesModal
        open={dupModal}
        onClose={() => setDupModal(false)}
        groups={duplicateGroups}
        renderLabel={c => c.name}
        renderDetail={c => c.website || c.email || '—'}
        onMerge={mergeCompanies}
      />
    </div>
  );
}
