import { useEffect, useState } from 'react';
import { Plus, Zap, Trash2, Power, Pencil, ScrollText, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { PageHeader, Card, Button, Modal, Input, Select, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../lib/utils';
import type { Automation, AutomationRun } from '../../lib/types';

// Only triggers/actions that are actually wired to a real DB trigger + edge function execution
// (see supabase/migrations/*_automations_engine.sql and supabase/functions/automations-*).
// Nothing here is decorative: every option a user can pick actually does something.
const TRIGGERS = [
  { value: 'deal_created', fr: 'Deal créé', en: 'Deal created' },
  { value: 'deal_won', fr: 'Deal gagné', en: 'Deal won' },
  { value: 'contact_added', fr: 'Contact ajouté', en: 'Contact added' },
  { value: 'task_overdue', fr: 'Tâche en retard', en: 'Task overdue' },
  { value: 'activity_done', fr: 'Activité terminée', en: 'Activity completed' },
];

const ACTIONS = [
  { value: 'send_email', fr: 'Envoyer un email', en: 'Send email' },
  { value: 'create_task', fr: 'Créer une tâche', en: 'Create task' },
  { value: 'notify_team', fr: "Notifier l'équipe", en: 'Notify team' },
  { value: 'create_activity', fr: 'Créer une activité', en: 'Create activity' },
];

const STATUS_ICON = { success: CheckCircle2, error: XCircle, skipped: MinusCircle };
const STATUS_COLOR = { success: 'green', error: 'red', skipped: 'gray' } as const;
const STATUS_TEXT_CLASS = { success: 'text-green-500', error: 'text-red-500', skipped: 'text-gray-400' } as const;

export function Automations() {
  const { tenant } = useAuth();
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [form, setForm] = useState({ name: '', trigger: TRIGGERS[0].value, action: ACTIONS[0].value, description: '' });
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false }).limit(500);
    setItems(data || []);
    setLoading(false);
  };

  const loadRuns = async () => {
    const { data } = await supabase.from('automation_runs').select('*').order('created_at', { ascending: false }).limit(50);
    setRuns(data || []);
  };

  useEffect(() => { load(); loadRuns(); }, [tenant]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', trigger: TRIGGERS[0].value, action: ACTIONS[0].value, description: '' });
    setModal(true);
  };

  const openEdit = (a: Automation) => {
    setEditing(a);
    setForm({ name: a.name, trigger: a.trigger, action: a.action, description: a.description || '' });
    setModal(true);
  };

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    setSaving(true);
    if (editing) {
      const { data } = await supabase.from('automations').update({
        name: form.name, trigger: form.trigger, action: form.action, description: form.description,
      }).eq('id', editing.id).select().single();
      if (data) setItems(prev => prev.map(x => x.id === editing.id ? data : x));
    } else {
      const { data } = await supabase.from('automations').insert({
        name: form.name, trigger: form.trigger, action: form.action, description: form.description,
        tenant_id: tenant.id, is_active: true,
      }).select().single();
      if (data) setItems(prev => [data, ...prev]);
    }
    setSaving(false);
    setModal(false);
  };

  const toggle = async (a: Automation) => {
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x));
    await supabase.from('automations').update({ is_active: !a.is_active }).eq('id', a.id);
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id));
    await supabase.from('automations').delete().eq('id', id);
  };

  const tr = (arr: typeof TRIGGERS, v: string) => arr.find(x => x.value === v)?.[lang] || v;
  const automationName = (id: string | null) => items.find(a => a.id === id)?.name || (lang === 'fr' ? 'Automatisation supprimée' : 'Deleted automation');

  return (
    <div>
      <PageHeader
        title={t('mod.automations')}
        subtitle={lang === 'fr' ? 'Déclencheurs et actions sans code — réellement exécutés en arrière-plan' : 'No-code triggers and actions — actually executed in the background'}
        actions={(
          <>
            <Button variant="secondary" onClick={() => setLogOpen(true)}><ScrollText size={16} /> {lang === 'fr' ? "Journal d'exécution" : 'Execution log'}</Button>
            <Button onClick={openCreate}><Plus size={16} /> {lang === 'fr' ? 'Nouvelle automatisation' : 'New automation'}</Button>
          </>
        )}
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3].map(i => <Card key={i} className="h-28 animate-pulse bg-gray-50" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Zap}
            title={lang === 'fr' ? 'Aucune automatisation' : 'No automations yet'}
            description={lang === 'fr' ? 'Créez votre première automatisation pour gagner du temps.' : 'Create your first automation to save time.'}
            action={<Button onClick={openCreate}>{lang === 'fr' ? 'Créer' : 'Create'}</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(a => (
            <Card key={a.id} className="group p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${a.is_active ? 'bg-coral-50 text-coral-700' : 'bg-gray-100 text-gray-400'}`}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      {lang === 'fr' ? 'Si' : 'If'} <b>{tr(TRIGGERS, a.trigger)}</b> → {tr(ACTIONS, a.action)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={15} /></button>
                  <button onClick={() => toggle(a)} className={`rounded-lg p-1.5 ${a.is_active ? 'text-mint-600 hover:bg-mint-50' : 'text-gray-400 hover:bg-gray-100'}`}><Power size={15} /></button>
                  <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
              {a.description && <p className="mt-2 text-xs text-gray-500">{a.description}</p>}
              <div className="mt-2"><Badge color={a.is_active ? 'green' : 'gray'}>{a.is_active ? (lang === 'fr' ? 'Active' : 'Active') : (lang === 'fr' ? 'Inactive' : 'Inactive')}</Badge></div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? (lang === 'fr' ? "Modifier l'automatisation" : 'Edit automation') : (lang === 'fr' ? 'Nouvelle automatisation' : 'New automation')}>
        <div className="space-y-3">
          <Input
            label={lang === 'fr' ? 'Nom' : 'Name'}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder={lang === 'fr' ? 'Ex: Relance auto deal gagné' : 'e.g. Auto follow-up on won deal'}
          />
          <Select
            label={lang === 'fr' ? 'Déclencheur' : 'Trigger'}
            value={form.trigger}
            onChange={e => setForm({ ...form, trigger: e.target.value })}
          >
            {TRIGGERS.map(tr => <option key={tr.value} value={tr.value}>{tr[lang]}</option>)}
          </Select>
          <Select
            label={lang === 'fr' ? 'Action' : 'Action'}
            value={form.action}
            onChange={e => setForm({ ...form, action: e.target.value })}
          >
            {ACTIONS.map(a => <option key={a.value} value={a.value}>{a[lang]}</option>)}
          </Select>
          <Input
            label={lang === 'fr' ? 'Description (optionnel)' : 'Description (optional)'}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder={lang === 'fr' ? 'Détails sur cette automatisation' : 'Details about this automation'}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? t('common.loading') : editing ? t('common.save') : t('common.create')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title={lang === 'fr' ? "Journal d'exécution" : 'Execution log'} size="lg">
        {runs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            {lang === 'fr'
              ? "Aucune exécution pour l'instant. Ce journal se remplit dès qu'un déclencheur se produit (deal créé, contact ajouté…)."
              : 'No executions yet. This log fills up as soon as a trigger occurs.'}
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {runs.map(r => {
              const Icon = STATUS_ICON[r.status];
              return (
                <div key={r.id} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                  <Icon size={16} className={`mt-0.5 flex-shrink-0 ${STATUS_TEXT_CLASS[r.status]}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{automationName(r.automation_id)}</p>
                      <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500">{tr(TRIGGERS, r.trigger)} → {r.action ? tr(ACTIONS, r.action) : '—'}</p>
                    {r.detail && <p className="mt-1 text-xs text-gray-600">{r.detail}</p>}
                  </div>
                  <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
