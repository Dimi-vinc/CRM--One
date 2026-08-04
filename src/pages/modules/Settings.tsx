import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCog, Building2, Upload, Check, AlertCircle, Loader2, Mail, Unplug, Link2, Paintbrush, CreditCard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Input, Select, Avatar } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { COUNTRIES, CURRENCIES } from '../../lib/constants';

interface EmailConnection { provider: 'gmail' | 'outlook'; email_address: string }

type ThemeId = 'ocean' | 'coral' | 'classic';
const THEMES: ReadonlyArray<{ id: ThemeId; name: string; color: string; previewClass: string }> = [
  { id: 'ocean', name: 'Ocean Blue (Défaut)', color: '#0369A1', previewClass: 'bg-[#0369A1]' },
  { id: 'coral', name: 'Corail Alternatif', color: '#FF6B35', previewClass: 'bg-[#FF6B35]' },
  { id: 'classic', name: 'Thème Actuel (Classic)', color: '#fb5d1f', previewClass: 'bg-[#fb5d1f]' },
];

const colorsData = {
  ocean: {
    '50': '#f0f9ff', '100': '#e0f2fe', '200': '#bae6fd', '300': '#7dd3fc', '400': '#38bdf8',
    '500': '#0369a1', '600': '#025a8b', '700': '#014a75', '800': '#013b5e', '900': '#0c2d48'
  },
  coral: {
    '50': '#fff5f0', '100': '#ffe3d1', '200': '#ffc4a3', '300': '#ffa070', '400': '#ff7e42',
    '500': '#ff6b35', '600': '#e0531f', '700': '#bc3d11', '800': '#962d0a', '900': '#7a2107'
  },
  classic: {
    '50': '#fff5f0', '100': '#ffe8da', '200': '#ffcfb5', '300': '#ffac7f', '400': '#ff7e3f',
    '500': '#fb5d1f', '600': '#ec4a0c', '700': '#c43a09', '800': '#9c3110', '900': '#7e2c11'
  }
};

export function Settings() {
  const { profile, tenant, refresh } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentTheme, setCurrentTheme] = useState<ThemeId>((localStorage.getItem('crm_theme') as ThemeId) || 'ocean');

  const selectTheme = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    localStorage.setItem('crm_theme', themeId);
    const selectedColors = colorsData[themeId];
    const root = document.documentElement;
    Object.entries(selectedColors).forEach(([key, val]) => {
      root.style.setProperty(`--color-primary-${key}`, val);
    });
  };

  const [connections, setConnections] = useState<EmailConnection[]>([]);
  const [connLoading, setConnLoading] = useState(true);
  const [connectMessage, setConnectMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [tenantForm, setTenantForm] = useState({
    name: tenant?.name || '', currency_code: tenant?.currency_code || 'USD',
    timezone: tenant?.timezone || 'Africa/Douala', country_code: tenant?.country_code || 'CM',
  });
  const [savingTenant, setSavingTenant] = useState(false);
  const [tenantSaved, setTenantSaved] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const loadConnections = useCallback(async () => {
    setConnLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setConnLoading(false); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-connection-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConnections(data.connections || []);
    } catch {
      setConnections([]);
    }
    setConnLoading(false);
  }, []);

  useEffect(() => {
    loadConnections();
    const params = new URLSearchParams(window.location.search);
    const status = params.get('email_connect');
    if (status === 'success') setConnectMessage({ type: 'success', text: 'Compte email connecté avec succès.' });
    else if (status === 'not_configured') setConnectMessage({ type: 'error', text: "Cette intégration n'est pas encore configurée par l'administrateur de la plateforme." });
    else if (status === 'error') setConnectMessage({ type: 'error', text: 'La connexion a échoué. Réessayez.' });
    if (status) window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0]);
  }, [loadConnections]);

  const startConnect = async (provider: 'gmail' | 'outlook') => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token || !tenant) return;
    const state = btoa(JSON.stringify({ accessToken: token, tenantId: tenant.id }));
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (provider === 'gmail') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) { setConnectMessage({ type: 'error', text: "Google n'est pas encore configuré." }); return; }
      const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;
      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&access_type=offline&prompt=consent&scope=${encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email')}&state=${encodeURIComponent(state)}`;
      window.location.href = url;
    } else {
      const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
      if (!clientId) { setConnectMessage({ type: 'error', text: "Microsoft n'est pas encore configuré." }); return; }
      const redirectUri = `${supabaseUrl}/functions/v1/outlook-oauth-callback`;
      const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&response_mode=query&scope=${encodeURIComponent('offline_access Mail.Send User.Read')}&state=${encodeURIComponent(state)}`;
      window.location.href = url;
    }
  };

  const disconnect = async (provider: 'gmail' | 'outlook') => {
    setDisconnecting(provider);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (token) {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/disconnect-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
    }
    await loadConnections();
    setDisconnecting(null);
  };

  const gmailConn = connections.find(c => c.provider === 'gmail');
  const outlookConn = connections.find(c => c.provider === 'outlook');

  const saveProfile = async () => {
    if (!profile || !fullName.trim()) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim(), phone: phone.trim() || null }).eq('id', profile.id);
    setSavingProfile(false);
    if (!error) {
      setProfileSaved(true);
      await refresh();
      setTimeout(() => setProfileSaved(false), 2500);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) return;
    setAvatarError(null);
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Image trop lourde (max 2 Mo).'); return; }
    if (!file.type.startsWith('image/')) { setAvatarError('Le fichier doit être une image.'); return; }
    setUploadingAvatar(true);
    const path = `${profile.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) {
      setUploadingAvatar(false);
      setAvatarError(upErr.message.includes('Bucket not found')
        ? "Le stockage des avatars n'est pas encore configuré (migration 0013 non appliquée)."
        : upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', profile.id);
    setUploadingAvatar(false);
    if (updErr) { setAvatarError(updErr.message); return; }
    await refresh();
  };

  const saveTenant = async () => {
    if (!tenant) return;
    setSavingTenant(true);
    const { error } = await supabase.from('tenants').update(tenantForm).eq('id', tenant.id);
    setSavingTenant(false);
    if (!error) {
      setTenantSaved(true);
      await refresh();
      setTimeout(() => setTenantSaved(false), 2500);
    }
  };

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Votre profil personnel et les informations de votre entreprise"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><UserCog size={20} /></div>
            <div>
              <h3 className="font-semibold text-gray-900">Mon profil</h3>
              <p className="text-sm text-gray-500">Nom affiché et photo de profil.</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <Avatar name={profile?.full_name || profile?.email} src={profile?.avatar_url || undefined} size={64} />
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}>
                {uploadingAvatar ? <><Loader2 size={13} className="animate-spin" /> Envoi…</> : <><Upload size={13} /> Changer la photo</>}
              </Button>
              <p className="mt-1 text-[11px] text-gray-400">JPG/PNG, 2 Mo max.</p>
            </div>
          </div>
          {avatarError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /><span>{avatarError}</span>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <Input label="Nom complet" value={fullName} onChange={e => setFullName(e.target.value)} />
            <Input label="Téléphone (WhatsApp)" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+237600000000" hint="Format international avec indicatif (+237, +33, +971…). Utilisé pour les notifications WhatsApp." />
            <Input label="Email" value={profile?.email || ''} disabled />
            <p className="text-[11px] text-gray-400">L'email ne peut pas être modifié ici. La langue se change via le sélecteur en haut à droite.</p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={saveProfile} disabled={savingProfile || !fullName.trim()}>
              {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {profileSaved && <span className="flex items-center gap-1 text-sm text-mint-600"><Check size={14} /> Enregistré</span>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-coral-50 p-2.5 text-coral-700"><Building2 size={20} /></div>
            <div>
              <h3 className="font-semibold text-gray-900">Entreprise</h3>
              <p className="text-sm text-gray-500">{isAdmin ? 'Informations générales de votre compte.' : 'Visible par les administrateurs uniquement pour modification.'}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Input label="Nom de l'entreprise" value={tenantForm.name} onChange={e => setTenantForm({ ...tenantForm, name: e.target.value })} disabled={!isAdmin} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Pays" value={tenantForm.country_code} onChange={e => setTenantForm({ ...tenantForm, country_code: e.target.value })} disabled={!isAdmin}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </Select>
              <Select label="Devise" value={tenantForm.currency_code} onChange={e => setTenantForm({ ...tenantForm, currency_code: e.target.value })} disabled={!isAdmin}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
              </Select>
            </div>
            <Input label="Fuseau horaire" value={tenantForm.timezone} onChange={e => setTenantForm({ ...tenantForm, timezone: e.target.value })} disabled={!isAdmin} placeholder="Africa/Douala" />
          </div>

          {isAdmin ? (
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={saveTenant} disabled={savingTenant || !tenantForm.name.trim()}>
                {savingTenant ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
              {tenantSaved && <span className="flex items-center gap-1 text-sm text-mint-600"><Check size={14} /> Enregistré</span>}
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-400">Seul un administrateur peut modifier ces informations.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-6 mt-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Mail size={20} /></div>
            <div>
              <h3 className="font-semibold text-gray-900">Intégrations email</h3>
              <p className="text-sm text-gray-500">Connectez votre propre Gmail ou Outlook pour envoyer des emails aux contacts.</p>
            </div>
          </div>

          {connectMessage && (
            <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${connectMessage.type === 'success' ? 'bg-mint-50 text-mint-800' : 'bg-red-50 text-red-700'}`}>
              {connectMessage.type === 'success' ? <Check size={16} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />}
              <span>{connectMessage.text}</span>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {([['gmail', 'Gmail', gmailConn], ['outlook', 'Outlook', outlookConn]] as const).map(([provider, label, conn]) => (
              <div key={provider} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{connLoading ? 'Vérification…' : conn ? conn.email_address : 'Non connecté'}</p>
                </div>
                {connLoading ? (
                  <Loader2 size={16} className="animate-spin text-gray-300" />
                ) : conn ? (
                  <Button size="sm" variant="secondary" onClick={() => disconnect(provider)} disabled={disconnecting === provider}>
                    {disconnecting === provider ? '…' : <><Unplug size={13} /> Déconnecter</>}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => startConnect(provider)}><Link2 size={13} /> Connecter</Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600"><Paintbrush size={20} /></div>
            <div>
              <h3 className="font-semibold text-gray-900">Personnalisation du thème</h3>
              <p className="text-sm text-gray-500">Sélectionnez la couleur d'accentuation de l'interface CRM.</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-3">La modification s'applique instantanément sur tous vos modules.</p>
            <div className="grid gap-3 grid-cols-3">
              {THEMES.map(t => {
                const isActive = currentTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTheme(t.id)}
                    className={`flex flex-col items-center justify-between rounded-xl border p-3.5 transition-all text-center focus:outline-none ${isActive ? 'border-coral-500 ring-2 ring-coral-100 bg-coral-50/10' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className={`h-8 w-8 rounded-full shadow-sm mb-2 ${t.previewClass}`} />
                    <span className="text-[11px] font-semibold text-gray-900 leading-tight">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><CreditCard size={20} /></div>
            <div>
              <h3 className="font-semibold text-gray-900">Paiement & paramètres</h3>
              <p className="text-sm text-gray-500">Accédez rapidement à la facturation, à la sécurité et aux notifications.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link to="/billing">
              <Button className="w-full" variant="secondary"><CreditCard size={14} /> Voir la facturation</Button>
            </Link>
            <Link to="/security">
              <Button className="w-full" variant="secondary"><UserCog size={14} /> Paramètres de sécurité</Button>
            </Link>
            <Link to="/notifications">
              <Button className="w-full" variant="secondary"><Mail size={14} /> Notifications</Button>
            </Link>
            <Link to="/settings">
              <Button className="w-full" variant="secondary"><Building2 size={14} /> Paramètres généraux</Button>
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-900">Flutterwave</p>
            <p className="mt-2">La plateforme prend en charge Stripe et Flutterwave. Configurez les clés Flutterwave dans Supabase et choisissez Flutterwave dans la facturation pour accepter Orange Money, MTN MoMo, Wave, M-Pesa et les cartes locales.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
