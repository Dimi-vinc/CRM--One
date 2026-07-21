import { useEffect, useState } from 'react';
import { Plus, Zap, Trash2, Power, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { PageHeader, Card, Button, Modal, Input, Select, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Automation } from '../../lib/types';

const TRIGGERS = [
  { value: 'deal_created', fr: 'Deal créé', en: 'Deal created' },
  { value: 'deal_won', fr: 'Deal gagné', en: 'Deal won' },
  { value: 'contact_added', fr: 'Contact ajouté', en: 'Contact added' },
  { value: 'task_overdue', fr: 'Tâche en retard', en: 'Task overdue' },
  { value: 'activity_done', fr: 'Activité terminée', en: 'Activity completed' },
  { value: 'invoice_paid', fr: 'Facture payée', en: 'Invoice paid' },
  { value: 'ticket_opened', fr: 'Ticket ouvert', en: 'Ticket opened' },
];

const ACTIONS = [
  { value: 'send_email', fr: 'Envoyer email', en: 'Send email' },
  { value: 'create_task', fr: 'Créer tâche', en: 'Create task' },
  { value: 'notify_team', fr: 'Notifier l\'équipe', en: 'Notify team' },
  { value: 'update_deal', fr: 'Mettre à jour le deal', en: 'Update deal' },
  { value: 'create_activity', fr: 'Créer activité', en: 'Create activity' },
  { value: 'send_whatsapp', fr: 'Envoyer WhatsApp', en: 'Send WhatsApp' },
];

export function Automations() {
  const { tenant } = useAuth();
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [form, setForm] = useState({ name: '', trigger: TRIGGERS[0].value, action: ACTIONS[0].value, description: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant]);

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

  return (
    <div>
      <PageHeader
        title={t('mod.automations')}
        subtitle={lang === 'fr' ? 'Déclencheurs et actions sans code' : 'No-code triggers and actions'}
        actions={<Button onClick={openCreate}><Plus size={16} /> {lang === 'fr' ? 'Nouvelle automatisation' : 'New automation'}</Button>}
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? (lang === 'fr' ? 'Modifier l\'automatisation' : 'Edit automation') : (lang === 'fr' ? 'Nouvelle automatisation' : 'New automation')}>
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
    </div>
  );
}
