import { useEffect, useMemo, useState } from 'react';
import { Map, Plus, Target, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, EmptyState, Skeleton } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { COUNTRIES } from '../../lib/constants';
import type { SalesTerritory, SalesQuota, Profile, Deal } from '../../lib/types';

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Territories() {
  const { tenant } = useAuth();
  const [territories, setTerritories] = useState<SalesTerritory[]>([]);
  const [quotas, setQuotas] = useState<SalesQuota[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const [terrModal, setTerrModal] = useState(false);
  const [terrForm, setTerrForm] = useState<{ name: string; country_codes: string[]; owner_id: string }>({ name: '', country_codes: [], owner_id: '' });

  const [quotaModal, setQuotaModal] = useState(false);
  const [quotaForm, setQuotaForm] = useState({ user_id: '', period: currentPeriod(), target_amount: '' });

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const [{ data: t }, { data: q }, { data: p }, { data: d }] = await Promise.all([
      supabase.from('sales_territories').select('*').order('created_at', { ascending: false }),
      supabase.from('sales_quotas').select('*').order('period', { ascending: false }),
      supabase.from('profiles').select('*').eq('tenant_id', tenant.id),
      supabase.from('deals').select('*').eq('stage', 'won'),
    ]);
    setTerritories(t || []);
    setQuotas(q || []);
    setTeam(p || []);
    setDeals(d || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tenant]);

  const memberName = (id: string) => team.find(p => p.id === id)?.full_name || team.find(p => p.id === id)?.email || '—';

  const achievedFor = (userId: string, period: string) =>
    deals.filter(d => d.owner_id === userId && d.created_at.slice(0, 7) === period).reduce((s, d) => s + d.amount, 0);

  const createTerritory = async () => {
    if (!tenant || !terrForm.name.trim()) return;
    const { data } = await supabase.from('sales_territories').insert({
      tenant_id: tenant.id, name: terrForm.name, country_codes: terrForm.country_codes, owner_id: terrForm.owner_id || null,
    }).select().single();
    if (data) setTerritories(prev => [data, ...prev]);
    setTerrModal(false);
    setTerrForm({ name: '', country_codes: [], owner_id: '' });
  };

  const removeTerritory = async (id: string) => {
    setTerritories(prev => prev.filter(t => t.id !== id));
    await supabase.from('sales_territories').delete().eq('id', id);
  };

  const createQuota = async () => {
    if (!tenant || !quotaForm.user_id || !quotaForm.target_amount) return;
    const { data } = await supabase.from('sales_quotas').upsert({
      tenant_id: tenant.id, user_id: quotaForm.user_id, period: quotaForm.period,
      target_amount: Number(quotaForm.target_amount), currency_code: tenant.currency_code,
    }, { onConflict: 'tenant_id,user_id,period' }).select().single();
    if (data) setQuotas(prev => [data, ...prev.filter(q => !(q.user_id === data.user_id && q.period === data.period))]);
    setQuotaModal(false);
    setQuotaForm({ user_id: '', period: currentPeriod(), target_amount: '' });
  };

  return (
    <div>
      <PageHeader title="Territoires & Quotas" subtitle="Répartition géographique et objectifs de vente par commercial" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900"><Map size={18} /> Territoires</h3>
            <Button size="sm" onClick={() => setTerrModal(true)}><Plus size={14} /> Ajouter</Button>
          </div>
          {loading ? <Skeleton className="h-32" /> : territories.length === 0 ? (
            <Card className="p-6"><EmptyState icon={Map} title="Aucun territoire" description="Regroupez vos pays par commercial." /></Card>
          ) : (
            <div className="space-y-2">
              {territories.map(t => (
                <Card key={t.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.country_codes.join(', ') || 'Aucun pays'} · {t.owner_id ? memberName(t.owner_id) : 'Non assigné'}</p>
                    </div>
                    <button onClick={() => removeTerritory(t.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900"><Target size={18} /> Quotas ({currentPeriod()})</h3>
            <Button size="sm" onClick={() => setQuotaModal(true)}><Plus size={14} /> Définir</Button>
          </div>
          {loading ? <Skeleton className="h-32" /> : quotas.length === 0 ? (
            <Card className="p-6"><EmptyState icon={Target} title="Aucun quota" description="Fixez des objectifs mensuels par commercial." /></Card>
          ) : (
            <div className="space-y-2">
              {quotas.map(q => {
                const achieved = achievedFor(q.user_id, q.period);
                const pct = q.target_amount > 0 ? Math.min(100, Math.round((achieved / q.target_amount) * 100)) : 0;
                return (
                  <Card key={q.id} className="p-4">
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-medium text-gray-900">{memberName(q.user_id)}</p>
                      <span className="text-xs text-gray-500">{q.period}</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full bg-mint-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{formatMoney(achieved, q.currency_code)} / {formatMoney(q.target_amount, q.currency_code)} ({pct}%)</p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={terrModal} onClose={() => setTerrModal(false)} title="Nouveau territoire">
        <div className="space-y-3">
          <Input label="Nom" value={terrForm.name} onChange={e => setTerrForm({ ...terrForm, name: e.target.value })} placeholder="Ex: Afrique de l'Ouest" />
          <Select label="Responsable" value={terrForm.owner_id} onChange={e => setTerrForm({ ...terrForm, owner_id: e.target.value })}>
            <option value="">— Non assigné —</option>
            {team.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </Select>
          <div>
            <p className="label mb-1">Pays</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100 p-2">
              {COUNTRIES.map(c => (
                <label key={c.code} className="flex items-center gap-2 py-1 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={terrForm.country_codes.includes(c.code)}
                    onChange={e => setTerrForm({ ...terrForm, country_codes: e.target.checked ? [...terrForm.country_codes, c.code] : terrForm.country_codes.filter(x => x !== c.code) })}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setTerrModal(false)}>Annuler</Button>
            <Button onClick={createTerritory} disabled={!terrForm.name.trim()}>Créer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={quotaModal} onClose={() => setQuotaModal(false)} title="Définir un quota">
        <div className="space-y-3">
          <Select label="Commercial" value={quotaForm.user_id} onChange={e => setQuotaForm({ ...quotaForm, user_id: e.target.value })}>
            <option value="">— Sélectionner —</option>
            {team.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </Select>
          <Input label="Période (AAAA-MM)" value={quotaForm.period} onChange={e => setQuotaForm({ ...quotaForm, period: e.target.value })} placeholder="2026-07" />
          <Input label={`Objectif (${tenant?.currency_code || 'USD'})`} type="number" min={0} value={quotaForm.target_amount} onChange={e => setQuotaForm({ ...quotaForm, target_amount: e.target.value })} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setQuotaModal(false)}>Annuler</Button>
            <Button onClick={createQuota} disabled={!quotaForm.user_id || !quotaForm.target_amount}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
