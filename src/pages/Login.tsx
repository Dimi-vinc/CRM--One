import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button, Input } from '../components/ui';
import { supabase } from '../lib/supabase';
import { PLATFORM_NAME } from '../lib/constants';

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as any)?.from || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    nav(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-mint-50/30 lg:grid lg:grid-cols-2">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link to="/"><Logo size="lg" /></Link>
          <h1 className="mt-8 text-2xl font-bold text-gray-900">Bon retour</h1>
          <p className="mt-1 text-sm text-gray-500">Connectez-vous à votre espace {PLATFORM_NAME}.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input pl-9" placeholder="vous@entreprise.com" />
              </div>
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input pl-9" placeholder="••••••••" />
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Pas encore de compte ? <Link to="/signup" className="font-medium text-coral-600 hover:underline">Créer un compte</Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-gradient-to-br from-mint-100 via-mint-50 to-coral-50 lg:flex lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold text-gray-900">Le CRM qui parle la langue de l'Afrique</h2>
          <p className="mt-4 text-gray-600">Pipeline, devises panafricaines, Mobile Money, isolation multi-tenant. Pensé pour scaler par LIYHA GROUP.</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[['XOF','FCFA'],['XAF','FCFA'],['NGN','₦'],['KES','KSh'],['GHS','₵'],['ZAR','R']].map(([c,s]) => (
              <div key={c} className="card p-3 text-center"><p className="text-xs text-gray-500">{c}</p><p className="font-bold text-gray-900">{s}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
