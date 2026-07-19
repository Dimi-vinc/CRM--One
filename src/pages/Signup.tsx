import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, Building2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button, Input } from '../components/ui';
import { supabase } from '../lib/supabase';
import { PLATFORM_NAME } from '../lib/constants';

export function Signup() {
  const nav = useNavigate();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, company_name: companyName } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.user) {
      // Go to onboarding to create tenant + choose plan
      nav('/onboarding', { replace: true, state: { companyName, fullName } });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-mint-50/30 lg:grid lg:grid-cols-2">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link to="/"><Logo size="lg" /></Link>
          <h1 className="mt-8 text-2xl font-bold text-gray-900">Créer votre compte</h1>
          <p className="mt-1 text-sm text-gray-500">7 jours d'essai gratuit. Sans carte bancaire.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="label">Nom complet</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input required value={fullName} onChange={e => setFullName(e.target.value)} className="input pl-9" placeholder="Aminata Diallo" />
              </div>
            </div>
            <div>
              <label className="label">Nom de l'entreprise</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input required value={companyName} onChange={e => setCompanyName(e.target.value)} className="input pl-9" placeholder="Acme SARL" />
              </div>
            </div>
            <div>
              <label className="label">Email professionnel</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input pl-9" placeholder="vous@entreprise.com" />
              </div>
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="input pl-9" placeholder="6 caractères min." />
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Création…' : 'Créer mon compte'}
            </Button>
            <p className="text-center text-xs text-gray-400">En continuant, vous acceptez nos CGU et notre politique de confidentialité.</p>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Déjà un compte ? <Link to="/login" className="font-medium text-coral-600 hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-gradient-to-br from-coral-50 via-mint-50 to-mint-100 lg:flex lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold text-gray-900">Démarrez en 2 minutes</h2>
          <ul className="mt-6 space-y-3 text-gray-700">
            {['Pipeline visuel et activités','Devises panafricaines + Mobile Money','Isolation multi-tenant stricte','Rapports et forecast intégrés'].map(t => (
              <li key={t} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-coral-500" />{t}</li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-gray-500">Plateforme éditée par LIYHA GROUP — Dubaï · Yaoundé/Soa.</p>
        </div>
      </div>
    </div>
  );
}
