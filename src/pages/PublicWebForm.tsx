import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { WebForm } from '../lib/types';

export function PublicWebForm() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<WebForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!formId) return;
      const { data } = await supabase.from('web_forms').select('*').eq('id', formId).eq('is_active', true).maybeSingle();
      setForm(data);
      setLoading(false);
    })();
  }, [formId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-web-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ formId: form.id, data: values }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur lors de l\'envoi.'); return; }
      setDone(true);
      if (data.redirectUrl) setTimeout(() => { window.location.href = data.redirectUrl; }, 1200);
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex min-h-[200px] items-center justify-center"><Loader2 className="animate-spin text-gray-300" /></div>;
  if (!form) return <div className="flex min-h-[200px] items-center justify-center p-6 text-center text-sm text-gray-500">Formulaire introuvable ou désactivé.</div>;

  if (done) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center">
        <CheckCircle2 size={36} className="text-mint-600" />
        <p className="text-sm text-gray-700">{form.success_message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-5">
      <form onSubmit={submit} className="space-y-3">
        {form.fields.map(f => (
          <div key={f.key}>
            {f.type === 'consent' ? (
              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  required={f.required}
                  checked={!!values[f.key]}
                  onChange={e => setValues({ ...values, [f.key]: e.target.checked })}
                  className="mt-0.5"
                />
                <span>{f.label}{f.required && ' *'}</span>
              </label>
            ) : f.type === 'textarea' ? (
              <textarea
                className="input"
                placeholder={f.label + (f.required ? ' *' : '')}
                required={f.required}
                value={(values[f.key] as string) || ''}
                onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                rows={3}
              />
            ) : (
              <input
                className="input"
                type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
                placeholder={f.label + (f.required ? ' *' : '')}
                required={f.required}
                value={(values[f.key] as string) || ''}
                onChange={e => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
          </div>
        )}
        <button type="submit" disabled={submitting} className="btn-primary-landing w-full">
          {submitting ? 'Envoi…' : 'Envoyer'}
        </button>
      </form>
    </div>
  );
}
