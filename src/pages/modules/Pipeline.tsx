import { useEffect, useState } from 'react';
import { Plus, GripVertical, Trash2, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { DEAL_STAGES, CURRENCIES, formatMoney, sumDealAmounts, COLOR_RAMPS, type ColorKey } from '../../lib/constants';
import type { Deal, Contact, Company } from '../../lib/types';

export function Pipeline() {
  const { tenant } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', amount: '', currency_code: tenant?.currency_code || 'USD', stage: 'lead', contact_id: '', company_id: '', expected_close_date: '' });

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const [d, c, co] = await Promise.all([
      supabase.from('deals').select('*').order('created_at', { ascending: false }).limit(3000),
      supabase.from('contacts').select('*'),
      supabase.from('companies').select('*'),
    ]);
    setDeals(d.data || []);
    setContacts(c.data || []);
    setCompanies(co.data || []);
    setLoading(false);
  };

  // load() only reads `tenant` (already a dependency below) — intentionally omitted to avoid
  // recreating the effect trigger on every render, since a new `load` closure is made each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tenant]);

  const filtered = deals.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));

  const byStage = (stage: string) => filtered.filter(d => d.stage === stage);
  const stageTotal = (stage: string) => sumDealAmounts(byStage(stage), tenant?.currency_code || 'USD');

  const createDeal = async () => {
    if (!tenant || !form.title.trim()) return;
    const { data, error } = await supabase.from('deals').insert({
      tenant_id: tenant.id,
      title: form.title,
      amount: Number(form.amount) || 0,
      currency_code: form.currency_code,
      stage: form.stage,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      expected_close_date: form.expected_close_date || null,
      owner_id: null,
    }).select().single();
    if (!error && data) { setDeals(prev => [data, ...prev]); setModal(false); setForm({ title: '', amount: '', currency_code: tenant.currency_code, stage: 'lead', contact_id: '', company_id: '', expected_close_date: '' }); }
  };

  const moveStage = async (id: string, stage: string) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage } : d));
    await supabase.from('deals').update({ stage }).eq('id', id);
  };

  const remove = async (id: string) => {
    setDeals(prev => prev.filter(d => d.id !== id));
    await supabase.from('deals').delete().eq('id', id);
  };

  return (
    <div>
      <PageHeader
        title="Pipeline"
        subtitle="Deals par étape. Glissez pour faire avancer."
        actions={<Button onClick={() => setModal(true)}><Plus size={16} /> Nouveau deal</Button>}
      />

      <div className="mb-4 relative max-w-md">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un deal…" className="input pl-9" />
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-6">
          {DEAL_STAGES.map(stage => <Card key={stage.id} className="h-40 animate-pulse bg-gray-50" />)}
        </div>
      ) : (
      <div className="grid gap-3 overflow-x-auto pb-4 lg:grid-cols-6">
        {DEAL_STAGES.map(stage => {
          const r = COLOR_RAMPS[(stage.color as ColorKey)] || COLOR_RAMPS.gray;
          const items = byStage(stage.id);
          return (
            <div key={stage.id} className="min-w-[220px]">
              <div className={`mb-2 flex items-center justify-between rounded-lg border-l-4 ${r.border} bg-white px-3 py-2 shadow-card`}>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{stage.label}</p>
                  <p className="text-xs text-gray-400">{items.length} · {formatMoney(stageTotal(stage.id), tenant?.currency_code || 'USD')}</p>
                </div>
              </div>
              <div
                className="space-y-2 min-h-[120px] rounded-xl bg-gray-50/60 p-2"
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragId) { moveStage(dragId, stage.id); setDragId(null); } }}
              >
                {items.map(d => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    className="group cursor-grab rounded-lg border border-gray-100 bg-white p-3 shadow-card hover:shadow-cardHover active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-gray-900">{d.title}</p>
                      <button onClick={() => remove(d.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-coral-600">{formatMoney(d.amount, d.currency_code)}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                      <GripVertical size={12} /> {d.expected_close_date || '—'}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="py-4 text-center text-xs text-gray-300">Vide</p>}
              </div>
            </div>
          );
        })}
      </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nouveau deal">
        <div className="space-y-3">
          <Input label="Titre" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Deal Acme — renouvellement" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Montant" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <Select label="Devise" value={form.currency_code} onChange={e => setForm({ ...form, currency_code: e.target.value })}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </div>
          <Select label="Étape" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
            {DEAL_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Contact" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}>
              <option value="">—</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </Select>
            <Select label="Entreprise" value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}>
              <option value="">—</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Input label="Date de clôture prévue" type="date" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={createDeal}>Créer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
