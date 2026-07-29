import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';

export function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase exchanges the recovery token in the URL for a temporary session and fires
    // a PASSWORD_RECOVERY auth event. We listen for it rather than assuming any existing
    // session means a valid recovery link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidLink(true);
        setReady(true);
      }
    });
    // Fallback: if the event already fired before this component mounted, a session may
    // already be present — treat any session on this page as valid to update.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValidLink(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => nav('/login', { replace: true }), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-blue-50/30 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><Logo size="lg" /></div>

        {!ready ? (
          <p className="mt-8 text-center text-sm text-gray-400">Vérification du lien…</p>
        ) : !validLink ? (
          <div className="mt-8 text-center">
            <AlertCircle size={36} className="mx-auto text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-gray-900">Lien invalide ou expiré</h1>
            <p className="mt-2 text-sm text-gray-500">Ce lien de réinitialisation n'est plus valide. Demandez-en un nouveau.</p>
            <Link to="/forgot-password" className="mt-6 inline-block text-sm font-medium text-blue-700 hover:underline">Demander un nouveau lien</Link>
          </div>
        ) : done ? (
          <div className="mt-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-blue-600" />
            <h1 className="mt-4 text-xl font-bold text-gray-900">Mot de passe mis à jour</h1>
            <p className="mt-2 text-sm text-gray-500">Redirection vers la connexion…</p>
          </div>
        ) : (
          <>
            <h1 className="mt-8 text-2xl font-bold text-gray-900">Nouveau mot de passe</h1>
            <p className="mt-1 text-sm text-gray-500">Choisissez un mot de passe d'au moins 8 caractères.</p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div>
                <label className="label">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input pl-9" placeholder="••••••••" />
                </div>
              </div>
              <div>
                <label className="label">Confirmer le mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="input pl-9" placeholder="••••••••" />
                </div>
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
