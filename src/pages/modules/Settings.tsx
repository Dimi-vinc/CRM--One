import { useRef, useState } from 'react';
import { UserCog, Building2, Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { PageHeader, Card, Button, Input, Select, Avatar } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { COUNTRIES, CURRENCIES } from '../../lib/constants';

export function Settings() {
  const { profile, tenant, refresh } = useAuth();
  const { lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
}
