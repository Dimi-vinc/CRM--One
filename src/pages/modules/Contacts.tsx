import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, Edit2, Building2, ArrowUpDown, Copy } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Avatar, Badge, EmptyState } from '../../components/ui';
import { DuplicatesModal } from '../../components/DuplicatesModal';
import { supabase } from '../../lib/supabase';
import { COUNTRIES } from '../../lib/constants';
import { computeLeadScore, BAND_LABEL, BAND_COLOR } from '../../lib/leadScoring';
import { findContactDuplicates } from '../../lib/dedup';
import type { Contact, Company } from '../../lib/types';

export function Contacts() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contactsWithActivity, setContactsWithActivity] = useState<Set<string>>(new Set());
  const [contactsWithDeal, setContactsWithDeal] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sortByScore, setSortByScore] = useState(false);
  const [modal, setModal] = useState(false);
  const [dupModal, setDupModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company_id: '', country_code: tenant?.country_code || 'CM', city: '', marketing_consent: false });

  // Safety cap: the search/sort/dedup UX below runs client-side over the loaded set, which
  // is instant and simple for realistic tenant sizes but would not scale to hundreds of
  // thousands of rows. Rather than silently truncating, we show an explicit notice past this
  // cap and recommend using Import/Export or contacting support for bulk operations.
  const LOAD_CAP = 2000;

  const load = async () => {
    if (!tenant) return;
    const [c, co, act, deals] = await Promise.all([
      supabase.from('contacts').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, LOAD_CAP - 1),
      supabase.from('companies').select('*'),
      supabase.from('activities').select('contact_id').not('contact_id', 'is', null),
      supabase.from('deals').select('contact_id').not('contact_id', 'is', null),
    ]);
    setItems(c.data || []);
    setTotalCount(c.count ?? (c.data || []).length);
    setCompanies(co.data || []);
    setContactsWithActivity(new Set((act.data || []).map((a: { contact_id: string }) => a.contact_id)));
    setContactsWithDeal(new Set((deals.data || []).map((d: { contact_id: string }) => d.contact_id)));
  };
  useEffect(() => { load(); }, [tenant]);

  const scored = useMemo(
    () => items.map(c => ({ contact: c, score: computeLeadScore(c, contactsWithActivity.has(c.id), contactsWithDeal.has(c.id)) })),
    [items, contactsWithActivity, contactsWithDeal]
  );
  const duplicateGroups = useMemo(() => findContactDuplicates(items), [items]);

  const filtered = scored
    .filter(({ contact: c }) => `${c.first_name} ${c.last_name || ''} ${c.email || ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortByScore ? b.score.score - a.score.score : 0);
  const companyName = (id?: string | null) => companies.find(c => c.id === id)?.name;

  const mergeContacts = async (primaryId: string, duplicateIds: string[]) => {
    const primary = items.find(c => c.id === primaryId);
    const dups = items.filter(c => duplicateIds.includes(c.id));
    if (!primary) return;

    // Fill any blank fields on the primary from the duplicates before discarding them
    const merged: Partial<Contact> = {};
    (['email', 'phone', 'company_id', 'city', 'country_code'] as const).forEach(field => {
      if (!primary[field]) {
        const donor = dups.find(d => d[field]);
        if (donor) merged[field] = donor[field] as never;
      }
    });
    if (Object.keys(merged).length > 0) {
      await supabase.from('contacts').update(merged).eq('id', primaryId);
    }
    await Promise.all([
      supabase.from('deals').update({ contact_id: primaryId }).in('contact_id', duplicateIds),
      supabase.from('activities').update({ contact_id: primaryId }).in('contact_id', duplicateIds),
    ]);
    await supabase.from('contacts').delete().in('id', duplicateIds);
    await load();
  };

  const save = async () => {
    if (!tenant || !form.first_name.trim()) return;
    const payload = { ...form, company_id: form.company_id || null, consent_updated_at: new Date().toISOString() };
    if (editing) {
      const { data } = await supabase.from('contacts').update(payload).eq('id', editing.id).select().single();
      if (data) setItems(prev => prev.map(c => c.id === editing.id ? data : c));
    } else {
      const { data } = await supabase.from('contacts').insert({ ...payload, tenant_id: tenant.id }).select().single();
      if (data) setItems(prev => [data, ...prev]);
    }
    setModal(false); setEditing(null);
    setForm({ first_name: '', last_name: '', email: '', phone: '', company_id: '', country_code: tenant.country_code, city: '', marketing_consent: false });
  };

  const edit = (c: Contact) => {
    setEditing(c);
    setForm({ first_name: c.first_name, last_name: c.last_name || '', email: c.email || '', phone: c.phone || '', company_id: c.company_id || '', country_code: c.country_code || 'CM', city: c.city || '', marketing_consent: c.marketing_consent || false });
    setModal(true);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(c => c.id !== id));
    await supabase.from('contacts').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader title="Contacts" subtitle={`${items.length} contact${items.length > 1 ? 's' : ''}`}
        actions={(
          <>
            {duplicateGroups.length > 0 && (
              <Button variant="secondary" onClick={() => setDupModal(true)}>
                <Copy size={16} /> {duplicateGroups.length} doublon{duplicateGroups.length > 1 ? 's' : ''}
              </Button>
            )}
            <Button onClick={() => { setEditing(null); setForm({ first_name: '', last_name: '', email: '', phone: '', company_id: '', country_code: tenant?.country_code || 'CM', city: '', marketing_consent: false }); setModal(true); }}><Plus size={16} /> Nouveau contact</Button>
          </>
        )} />

      {totalCount > LOAD_CAP && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Affichage limité aux {LOAD_CAP} contacts les plus récents sur {totalCount} au total. Utilisez Import/Export pour les opérations en masse sur l'ensemble de la base.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
        </div>
        <button
          onClick={() => setSortByScore(s => !s)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${sortByScore ? 'border-coral-300 bg-coral-50 text-coral-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
        >
          <ArrowUpDown size={14} /> Trier par score
        </button>
      </div>

      {items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Building2} title="Aucun contact" description="Ajoutez votre premier contact pour démarrer." action={<Button onClick={() => setModal(true)}><Plus size={16} /> Ajouter</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nom</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Téléphone</th><th className="px-4 py-3">Entreprise</th><th className="px-4 py-3">Pays</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(({ contact: c, score }) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={`${c.first_name} ${c.last_name || ''}`} size={32} />
                      <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={BAND_COLOR[score.band]} title={score.reasons.join(' · ') || 'Aucun signal d\'engagement pour le moment'}>
                      {score.score} · {BAND_LABEL[score.band]}
                    </Badge>
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
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.marketing_consent} onChange={e => setForm({ ...form, marketing_consent: e.target.checked })} />
            Consentement marketing (autorise l'envoi de campagnes email — RGPD)
          </label>
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
        renderLabel={c => `${c.first_name} ${c.last_name || ''}`}
        renderDetail={c => c.email || c.phone || '—'}
        onMerge={mergeContacts}
      />
    </div>
  );
}
