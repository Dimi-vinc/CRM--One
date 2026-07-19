import { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone, KeyRound, Monitor, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';

export function Security() {
  const { profile } = useAuth();
  const [twoFA, setTwoFA] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    // Supabase does not expose a sessions list via anon SDK; we show the current session.
    setSessions([{ id: 'current', device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop', browser: navigator.userAgent, ip: '—', current: true, created_at: new Date().toISOString() }]);
  }, []);

  return (
    <div>
      <PageHeader title="Sécurité" subtitle="2FA, sessions actives, journal de connexion" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><Lock size={20} /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Authentification à deux facteurs</h3>
              <p className="text-sm text-gray-500">Renforcez la sécurité de votre compte.</p>
            </div>
            <Badge color={twoFA ? 'green' : 'gray'}>{twoFA ? 'Activée' : 'Inactive'}</Badge>
          </div>
          <Button className="mt-4 w-full" variant={twoFA ? 'secondary' : 'primary'} onClick={() => setTwoFA(v => !v)}>
            {twoFA ? 'Désactiver la 2FA' : 'Activer la 2FA'}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-coral-50 p-2.5 text-coral-700"><KeyRound size={20} /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Mot de passe</h3>
              <p className="text-sm text-gray-500">Modifiez-le régulièrement.</p>
            </div>
          </div>
          <Button className="mt-4 w-full" variant="secondary" onClick={() => supabase.auth.resetPasswordForEmail(profile?.email || '')}>
            Réinitialiser par email
          </Button>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Sessions actives</h3>
          <Monitor size={18} className="text-gray-400" />
        </div>
        <div className="mt-4 divide-y divide-gray-50">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center gap-3 py-3">
              <Smartphone size={18} className="text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{s.device} {s.current && <Badge color="green" className="ml-2">Actuelle</Badge>}</p>
                <p className="text-xs text-gray-500">Démarrée {formatDateTime(s.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} className="text-mint-600" />
          <h3 className="font-semibold text-gray-900">Journal de connexion</h3>
        </div>
        <p className="mt-3 text-sm text-gray-500">Le journal détaillé des connexions est visible par le Super Admin dans le journal d'audit global.</p>
      </Card>
    </div>
  );
}
