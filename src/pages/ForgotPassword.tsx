import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password`,
    });
    setLoading(false);
    // Always show a success state, even on error — never reveal whether an email exists
    // (prevents account enumeration). The real error is only logged, not shown to the user.
    if (err) console.error(err.message);
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-blue-50/30 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><Link to="/"><Logo size="lg" /></Link></div>

        {sent ? (
          <div className="mt-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-blue-600" />
            <h1 className="mt-4 text-xl font-bold text-gray-900">Vérifiez votre boîte mail</h1>
            <p className="mt-2 text-sm text-gray-500">
              Si un compte existe pour <b>{email}</b>, un lien de réinitialisation vient d'être envoyé. Le lien expire après une heure.
            </p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline">
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mt-8 text-2xl font-bold text-gray-900">Mot de passe oublié ?</h1>
            <p className="mt-1 text-sm text-gray-500">Entrez votre email, nous vous enverrons un lien de réinitialisation.</p>
            <form onSubmit={submit} className="mt-8 space-y-4">
              <div>
                <label className="label">Adresse email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input pl-9" placeholder="vous@entreprise.com" />
                </div>
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </Button>
            </form>
            <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={14} /> Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
