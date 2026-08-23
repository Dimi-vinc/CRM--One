import { useEffect, useState } from 'react';
import { Plus, Trash2, Power, Copy, Check, FileInput, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { WebForm, WebFormField, WebFormFieldType, WebFormSubmission } from '../../lib/types';

const FIELD_TYPES: { value: WebFormFieldType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Téléphone' },
  { value: 'textarea', label: 'Message (long)' },
  { value: 'consent', label: 'Case de consentement RGPD' },
];

const DEFAULT_FIELDS: WebFormField[] = [
  { key: 'name', label: 'Nom complet', type: 'text', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'phone', label: 'Téléphone', type: 'phone' },
  { key: 'message', label: 'Message', type: 'textarea' },
  { key: 'marketing_consent', label: "J'accepte de recevoir des communications par email", type: 'consent' },
];

function slugifyKey(label: string) {
  return label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'champ';
}

export function WebForms() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<WebForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<WebForm | null>(null);
  const [form, setForm] = useState({ name: '', success_message: 'Merci, nous vous recontacterons rapidement.', redirect_url: '' });
  const [fields, setFields] = useState<WebFormField[]>(DEFAULT_FIELDS);
  const [saving, setSaving] = useState(false);
  const [embedFor, setEmbedFor] = useState<WebForm | null>(null);
  const [copied, setCopied] = useState(false);
  const [subsFor, setSubsFor] = useState<WebForm | null>(null);
  const [submissions, setSubmissions] = useState<WebFormSubmission[]>([]);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('web_forms').select('*').order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  };
  // load() only reads `tenant` (already a dependency below) — intentionally omitted to avoid
  // recreating the effect trigger on every render, since a new `load` closure is made each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tenant]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', success_message: 'Merci, nous vous recontacterons rapidement.', redirect_url: '' });
    setFields(DEFAULT_FIELDS);
    setModal(true);
  };
  const openEdit = (f: WebForm) => {
    setEditing(f);
    setForm({ name: f.name, success_message: f.success_message, redirect_url: f.redirect_url || '' });
    setFields(f.fields);
    setModal(true);
  };

  const addField = () => setFields(prev => [...prev, { key: '', label: '', type: 'text' }]);
  const updateField = (i: number, patch: Partial<WebFormField>) => setFields(prev => prev.map((f, idx) => {
    if (idx !== i) return f;
    const next = { ...f, ...patch };
    if (patch.label !== undefined) next.key = slugifyKey(patch.label);
    return next;
  }));
  const removeField = (i: number) => setFields(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!tenant || !form.name.trim() || fields.length === 0) return;
    setSaving(true);
    if (editing) {
      const { data } = await supabase.from('web_forms').update({
        name: form.name, fields, success_message: form.success_message, redirect_url: form.redirect_url || null,
      }).eq('id', editing.id).select().single();
      if (data) setItems(prev => prev.map(x => x.id === editing.id ? data : x));
    } else {
      const { data } = await supabase.from('web_forms').insert({
        tenant_id: tenant.id, name: form.name, fields, success_message: form.success_message, redirect_url: form.redirect_url || null,
      }).select().single();
      if (data) setItems(prev => [data, ...prev]);
    }
    setSaving(false);
    setModal(false);
  };

  const toggle = async (f: WebForm) => {
    setItems(prev => prev.map(x => x.id === f.id ? { ...x, is_active: !x.is_active } : x));
    await supabase.from('web_forms').update({ is_active: !f.is_active }).eq('id', f.id);
  };
  const remove = async (id: string) => {
    setItems(prev => prev.filter(x => x.id !== id));
    await supabase.from('web_forms').delete().eq('id', id);
  };

  const openSubmissions = async (f: WebForm) => {
    setSubsFor(f);
    const { data } = await supabase.from('web_form_submissions').select('*').eq('form_id', f.id).order('created_at', { ascending: false }).limit(200);
    setSubmissions(data || []);
  };

  const embedCode = (f: WebForm) => {
    const url = `${window.location.origin}${window.location.pathname}#/f/${f.id}`;
    return `<iframe src="${url}" width="100%" height="480" frameborder="0" style="border:0;max-width:480px;"></iframe>`;
  };
  const copyEmbed = async (f: WebForm) => {
    await navigator.clipboard.writeText(embedCode(f));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Formulaires web"
        subtitle="Capturez des leads depuis votre site — chaque soumission crée un vrai contact et déclenche vos automatisations"
        actions={<Button onClick={openCreate}><Plus size={16} /> Nouveau formulaire</Button>}
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2].map(i => <Card key={i} className="h-32 animate-pulse bg-gray-50" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-8"><EmptyState icon={FileInput} title="Aucun formulaire" description="Créez votre premier formulaire pour capturer des leads." action={<Button onClick={openCreate}>Créer</Button>} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(f => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{f.name}</p>
                  <p className="text-xs text-gray-500">{f.fields.length} champ(s) · {f.submission_count} soumission(s)</p>
                </div>
                <Badge color={f.is_active ? 'green' : 'gray'}>{f.is_active ? 'Actif' : 'Inactif'}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(f)}>Modifier</Button>
                <Button size="sm" variant="secondary" onClick={() => setEmbedFor(f)}>Code d'intégration</Button>
                <Button size="sm" variant="secondary" onClick={() => openSubmissions(f)}><Users size={13} /> Soumissions</Button>
                <button onClick={() => toggle(f)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><Power size={15} /></button>
                <button onClick={() => remove(f.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le formulaire' : 'Nouveau formulaire'} size="lg">
        <div className="space-y-4">
          <Input label="Nom (interne)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Contact site web" />

          <div>
            <p className="label mb-2">Champs du formulaire</p>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2">
                  <input className="input flex-1" placeholder="Libellé du champ" value={f.label} onChange={e => updateField(i, { label: e.target.value })} />
                  <select className="input w-40" value={f.type} onChange={e => updateField(i, { type: e.target.value as WebFormFieldType })}>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                    <input type="checkbox" checked={!!f.required} onChange={e => updateField(i, { required: e.target.checked })} /> requis
                  </label>
                  <button onClick={() => removeField(i)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button onClick={addField} className="mt-2 text-xs font-medium text-coral-600 hover:underline">+ Ajouter un champ</button>
          </div>

          <Input label="Message de succès" value={form.success_message} onChange={e => setForm({ ...form, success_message: e.target.value })} />
          <Input label="URL de redirection (optionnel)" value={form.redirect_url} onChange={e => setForm({ ...form, redirect_url: e.target.value })} placeholder="https://votresite.com/merci" />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!embedFor} onClose={() => setEmbedFor(null)} title="Code d'intégration">
        {embedFor && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Collez ce code sur votre site (iframe), ou partagez directement le lien public :</p>
            <textarea readOnly className="input h-24 font-mono text-xs" value={embedCode(embedFor)} />
            <Input readOnly label="Lien direct" value={`${window.location.origin}${window.location.pathname}#/f/${embedFor.id}`} />
            <Button onClick={() => copyEmbed(embedFor)} className="w-full">
              {copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier le code</>}
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={!!subsFor} onClose={() => setSubsFor(null)} title={`Soumissions — ${subsFor?.name || ''}`} size="lg">
        {submissions.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Aucune soumission pour l'instant.</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {submissions.map(s => (
              <div key={s.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                <p className="text-xs text-gray-400">{formatDateTime(s.created_at)}</p>
                {Object.entries(s.data).map(([k, v]) => (
                  <p key={k} className="text-gray-700"><b className="capitalize">{k.replace(/_/g, ' ')}:</b> {String(v)}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
