import { useEffect, useState } from 'react';
import { ShieldCheck, Smartphone, KeyRound, Monitor, Lock, Copy, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Badge, Modal, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';

interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: 'verified' | 'unverified';
  created_at: string;
}

export function Security() {
  const { profile } = useAuth();
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);

  // Enrollment wizard state
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<MfaFactor | null>(null);

  const sessions = [{
    id: 'current',
    device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
    browser: navigator.userAgent,
    current: true,
    created_at: new Date().toISOString(),
  }];

  const loadFactors = async () => {
    setLoadingFactors(true);
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (!err && data) {
      setFactors([...(data.totp || [])] as MfaFactor[]);
    }
    setLoadingFactors(false);
  };

  useEffect(() => { loadFactors(); }, []);

  const verifiedFactor = factors.find(f => f.status === 'verified');

  const startEnroll = async () => {
    setError(null);
    setBusy(true);
    // Clean up any stale unverified factor before starting a new enrollment
    const stale = factors.find(f => f.status === 'unverified');
    if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

    const { data, error: err } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator (${new Date().toLocaleDateString()})`,
    });
    setBusy(false);
    if (err || !data) {
      setError(err?.message || "Impossible de démarrer l'activation de la 2FA.");
      return;
    }
    setEnrollFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setCode('');
    setEnrollOpen(true);
  };

  const confirmEnroll = async () => {
    if (!enrollFactorId || code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollFactorId });
    if (chErr || !challenge) {
      setBusy(false);
      setError(chErr?.message || 'Échec de la vérification.');
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrollFactorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verifyErr) {
      setError('Code invalide. Vérifiez votre application d\'authentification et réessayez.');
      return;
    }
    setEnrollOpen(false);
    setEnrollFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode('');
    await loadFactors();
  };

  const cancelEnroll = async () => {
    if (enrollFactorId) await supabase.auth.mfa.unenroll({ factorId: enrollFactorId });
    setEnrollOpen(false);
    setEnrollFactorId(null);
    setQrCode(null);
    setSecret(null);
    setError(null);
    await loadFactors();
  };

  const disableMfa = async (factor: MfaFactor) => {
    setBusy(true);
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    setConfirmDisable(null);
    await loadFactors();
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <PageHeader title="Sécurité" subtitle="2FA (TOTP), sessions actives, journal de connexion" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><Lock size={20} /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Authentification à deux facteurs</h3>
              <p className="text-sm text-gray-500">Protégez votre compte avec une app d'authentification (Google Authenticator, Authy, 1Password…).</p>
            </div>
            {!loadingFactors && <Badge color={verifiedFactor ? 'green' : 'gray'}>{verifiedFactor ? 'Activée' : 'Inactive'}</Badge>}
          </div>

          {verifiedFactor ? (
            <div className="mt-4">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-700">{verifiedFactor.friendly_name || 'Authenticator app'}</span>
                <span className="text-xs text-gray-400">Ajoutée le {formatDateTime(verifiedFactor.created_at)}</span>
              </div>
              <Button className="mt-3 w-full" variant="danger" disabled={busy} onClick={() => setConfirmDisable(verifiedFactor)}>
                Désactiver la 2FA
              </Button>
            </div>
          ) : (
            <Button className="mt-4 w-full" variant="primary" disabled={busy || loadingFactors} onClick={startEnroll}>
              Activer la 2FA
            </Button>
          )}
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
        <p className="mt-3 text-xs text-gray-400">L'API cliente Supabase n'expose que la session en cours. La révocation globale des sessions est possible via un appel admin côté serveur (à connecter au support si besoin).</p>
      </Card>

      <Card className="mt-6 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck size={20} className="text-mint-600" />
          <h3 className="font-semibold text-gray-900">Journal de connexion</h3>
        </div>
        <p className="mt-3 text-sm text-gray-500">Le journal détaillé des connexions est visible par le Super Admin dans le journal d'audit global.</p>
      </Card>

      {/* Enrollment modal */}
      <Modal open={enrollOpen} onClose={cancelEnroll} title="Activer la 2FA">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">1. Scannez ce QR code avec votre application d'authentification.</p>
          {qrCode && (
            <div className="flex justify-center rounded-xl border border-gray-100 bg-white p-4">
              <img src={qrCode} alt="QR code 2FA" width={180} height={180} />
            </div>
          )}
          {secret && (
            <div>
              <p className="text-xs text-gray-500">Ou entrez cette clé manuellement :</p>
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <code className="flex-1 truncate text-xs text-gray-700">{secret}</code>
                <button onClick={copySecret} className="text-gray-400 hover:text-gray-700">
                  {copied ? <Check size={14} className="text-mint-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}
          <p className="text-sm text-gray-600">2. Entrez le code à 6 chiffres généré par l'application.</p>
          <Input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
          />
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={cancelEnroll} disabled={busy}>Annuler</Button>
            <Button onClick={confirmEnroll} disabled={busy || code.length < 6}>{busy ? 'Vérification…' : 'Vérifier et activer'}</Button>
          </div>
        </div>
      </Modal>

      {/* Disable confirmation modal */}
      <Modal open={!!confirmDisable} onClose={() => setConfirmDisable(null)} title="Désactiver la 2FA ?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Votre compte sera protégé uniquement par votre mot de passe. Voulez-vous continuer ?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDisable(null)}><X size={14} /> Annuler</Button>
            <Button variant="danger" disabled={busy} onClick={() => confirmDisable && disableMfa(confirmDisable)}>Désactiver</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
