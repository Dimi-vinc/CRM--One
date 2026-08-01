import { useEffect, useState } from 'react';
import { Plus, Zap, Trash2, Power, Pencil, ScrollText, CheckCircle2, XCircle, MinusCircle, Clock, ArrowDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { PageHeader, Card, Button, Modal, Input, Select, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { timeAgo } from '../../lib/utils';
import type { Automation, AutomationRun } from '../../lib/types';

// Only triggers/actions that are actually wired to a real DB trigger + edge function execution.
// Nothing here is decorative: every option a user can pick actually does something.
const TRIGGERS = [
  { value: 'deal_created', fr: 'Deal créé', en: 'Deal created' },
  { value: 'deal_won', fr: 'Deal gagné', en: 'Deal won' },
  { value: 'contact_added', fr: 'Contact ajouté', en: 'Contact added' },
  { value: 'task_overdue', fr: 'Tâche en retard', en: 'Task overdue' },
  { value: 'activity_done', fr: 'Activité terminée', en: 'Activity completed' },
];

const ACTIONS = [
  { value: 'send_email', fr: "Email interne (équipe)", en: 'Internal email (team)' },
  { value: 'email_contact', fr: 'Email au contact (marketing)', en: 'Email the contact (marketing)' },
  { value: 'create_task', fr: 'Créer une tâche', en: 'Create task' },
  { value: 'notify_team', fr: "Notifier l'équipe", en: 'Notify team' },
  { value: 'create_activity', fr: 'Créer une activité', en: 'Create activity' },
  { value: 'send_whatsapp', fr: 'WhatsApp (équipe)', en: 'WhatsApp (team)' },
];

const DELAY_UNITS = [
  { value: 1, fr: 'minutes', en: 'minutes' },
  { value: 60, fr: 'heures', en: 'hours' },
  { value: 1440, fr: 'jours', en: 'days' },
];

const STATUS_ICON = { success: CheckCircle2, error: XCircle, skipped: MinusCircle };
const STATUS_COLOR = { success: 'green', error: 'red', skipped: 'gray' } as const;
const STATUS_TEXT_CLASS = { success: 'text-green-500', error: 'text-red-500', skipped: 'text-gray-400' } as const;

interface StepDraft { id?: string; action: string; description: string; delayValue: number; delayUnit: number }
const emptyStep = (): StepDraft => ({ action: ACTIONS[0].value, description: '', delayValue: 0, delayUnit: 1 });

interface StepRow { id: string; automation_id: string; position: number; delay_minutes: number; action: string; description: string | null }

export function Automations() {
  const { tenant } = useAuth();
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<Automation[]>([]);
  const [stepsByAutomation, setStepsByAutomation] = useState<Record<string, StepRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [form, setForm] = useState({ name: '', trigger: TRIGGERS[0].value });
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false }).limit(500);
    setItems(data || []);
    if (data && data.length > 0) {
      const { data: stepRows } = await supabase.from('automation_steps').select('*').in('automation_id', data.map(a => a.id)).order('position', { ascending: true });
      const grouped: Record<string, StepRow[]> = {};
      (stepRows || []).forEach((s: StepRow) => { (grouped[s.automation_id] ||= []).push(s); });
      setStepsByAutomation(grouped);
    }
    setLoading(false);
  };

  const loadRuns = async () => {
    const { data } = await supabase.from('automation_runs').select('*').order('created_at', { ascending: false }).limit(50);
    setRuns(data || []);
  };

  useEffect(() => { load(); loadRuns(); }, [tenant]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', trigger: TRIGGERS[0].value });
    setSteps([emptyStep()]);
    setModal(true);
  };

  const openEdit = (a: Automation) => {
    setEditing(a);
    setForm({ name: a.name, trigger: a.trigger });
    const existing = stepsByAutomation[a.id];
    if (existing && existing.length > 0) {
      setSteps(existing.map(s => {
        const unit = s.delay_minutes % 1440 === 0 && s.delay_minutes > 0 ? 1440 : s.delay_minutes % 60 === 0 && s.delay_minutes > 0 ? 60 : 1;
        return { id: s.id, action: s.action, description: s.description || '', delayValue: s.delay_minutes / unit, delayUnit: unit };
      }));
    } else {
      // Legacy single-action automation (no steps yet): edit as a 1-step sequence.
      setSteps([{ action: a.action, description: a.description || '', delayValue: 0, delayUnit: 1 }]);
    }
    setModal(true);
  };

  const save = async () => {
    if (!tenant || !form.name.trim() || steps.length === 0) return;
    setSaving(true);
    let automationId = editing?.id;
    const firstStep = steps[0];

    if (editing) {
      await supabase.from('automations').update({
        name: form.name, trigger: form.trigger, action: firstStep.action, description: firstStep.description || null,
      }).eq('id', editing.id);
      await supabase.from('automation_steps').delete().eq('automation_id', editing.id);
    } else {
      const { data } = await supabase.from('automations').insert({
        name: form.name, trigger: form.trigger, action: firstStep.action, description: firstStep.description || null,
        tenant_id: tenant.id, is_active: true,
      }).select().single();
      automationId = data?.id;
    }

    if (automationId) {
      // Only persist a steps list when there's more than one step, or the single step has a
      // delay — a plain 1-step-no-delay automation stays in the simple legacy shape (no rows in
      // automation_steps), which the dispatch function already handles identically either way.
      const needsStepsTable = steps.length > 1 || steps[0].delayValue > 0;
      if (needsStepsTable) {
        const rows = steps.map((s, i) => ({
          tenant_id: tenant.id, automation_id: automationId, position: i,
          delay_minutes: i === 0 ? 0 : s.delayValue * s.delayUnit, // step 0 always fires immediately; ITS delay field isn't used
          action: s.action, description: s.description || null,
        }));
        await supabase.from('automation_steps').insert(rows);
      }
    }

    await load();
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

  const addStep = () => setSteps(prev => [...prev, emptyStep()]);
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx));
  const updateStep = (idx: number, patch: Partial<StepDraft>) => setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  const tr = (arr: typeof TRIGGERS, v: string) => arr.find(x => x.value === v)?.[lang] || v;
  const actionLabel = (v: string) => ACTIONS.find(a => a.value === v)?.[lang] || v;
  const automationName = (id: string | null) => items.find(a => a.id === id)?.name || (lang === 'fr' ? 'Automatisation supprimée' : 'Deleted automation');

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return lang === 'fr' ? 'immédiat' : 'immediate';
    if (minutes % 1440 === 0) return `${minutes / 1440} ${lang === 'fr' ? 'j' : 'd'}`;
    if (minutes % 60 === 0) return `${minutes / 60} h`;
    return `${minutes} min`;
  };

  return (
    <div>
      <PageHeader
        title={t('mod.automations')}
        subtitle={lang === 'fr' ? 'Séquences multi-étapes avec délais — réellement exécutées en arrière-plan' : 'Multi-step sequences with delays — actually executed in the background'}
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
          {items.map(a => {
            const stepList = stepsByAutomation[a.id];
            const hasMultiStep = stepList && stepList.length > 0;
            return (
              <Card key={a.id} className="group p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${a.is_active ? 'bg-coral-50 text-coral-700' : 'bg-gray-100 text-gray-400'}`}>
                      <Zap size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-500">
                        {lang === 'fr' ? 'Si' : 'If'} <b>{tr(TRIGGERS, a.trigger)}</b>
                        {hasMultiStep ? ` → ${stepList.length} ${lang === 'fr' ? 'étapes' : 'steps'}` : ` → ${actionLabel(a.action)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(a)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={15} /></button>
                    <button onClick={() => toggle(a)} className={`rounded-lg p-1.5 ${a.is_active ? 'text-mint-600 hover:bg-mint-50' : 'text-gray-400 hover:bg-gray-100'}`}><Power size={15} /></button>
                    <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </div>
                {hasMultiStep && (
                  <div className="mt-3 space-y-1 border-l-2 border-gray-100 pl-3">
                    {stepList.map((s, i) => (
                      <p key={s.id} className="text-xs text-gray-500">
                        {i > 0 && <span className="text-gray-400">⏱ {formatDelay(s.delay_minutes)} → </span>}
                        {actionLabel(s.action)}
                      </p>
                    ))}
                  </div>
                )}
                <div className="mt-2"><Badge color={a.is_active ? 'green' : 'gray'}>{a.is_active ? (lang === 'fr' ? 'Active' : 'Active') : (lang === 'fr' ? 'Inactive' : 'Inactive')}</Badge></div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? (lang === 'fr' ? "Modifier l'automatisation" : 'Edit automation') : (lang === 'fr' ? 'Nouvelle automatisation' : 'New automation')} size="lg">
        <div className="space-y-4">
          <Input
            label={lang === 'fr' ? 'Nom' : 'Name'}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder={lang === 'fr' ? 'Ex: Séquence de relance lead' : 'e.g. Lead follow-up sequence'}
          />
          <Select label={lang === 'fr' ? 'Déclencheur' : 'Trigger'} value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value })}>
            {TRIGGERS.map(tr => <option key={tr.value} value={tr.value}>{tr[lang]}</option>)}
          </Select>

          <div>
            <p className="label mb-2">{lang === 'fr' ? 'Étapes de la séquence' : 'Sequence steps'}</p>
            <div className="space-y-3">
              {steps.map((s, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div className="my-2 flex items-center gap-2 text-xs text-gray-400">
                      <ArrowDown size={12} />
                      <Clock size={12} />
                      <span>{lang === 'fr' ? 'Attendre' : 'Wait'}</span>
                      <input type="number" min={0} value={s.delayValue} onChange={e => updateStep(i, { delayValue: Number(e.target.value) })} className="input w-16 px-2 py-1 text-xs" />
                      <select value={s.delayUnit} onChange={e => updateStep(i, { delayUnit: Number(e.target.value) })} className="input w-auto px-2 py-1 text-xs">
                        {DELAY_UNITS.map(u => <option key={u.value} value={u.value}>{u[lang]}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center gap-2">
                      <Select value={s.action} onChange={e => updateStep(i, { action: e.target.value })} className="flex-1">
                        {ACTIONS.map(a => <option key={a.value} value={a.value}>{a[lang]}</option>)}
                      </Select>
                      {steps.length > 1 && (
                        <button onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      )}
                    </div>
                    <input
                      className="input mt-2 text-sm"
                      placeholder={lang === 'fr' ? 'Description / message (optionnel)' : 'Description / message (optional)'}
                      value={s.description}
                      onChange={e => updateStep(i, { description: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addStep} className="mt-2 text-xs font-medium text-coral-600 hover:underline">
              + {lang === 'fr' ? 'Ajouter une étape (avec délai)' : 'Add a step (with delay)'}
            </button>
          </div>

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
                    <p className="text-xs text-gray-500">{tr(TRIGGERS, r.trigger)} → {r.action ? actionLabel(r.action) : '—'}</p>
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
