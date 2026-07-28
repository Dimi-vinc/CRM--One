import { useState } from 'react';
import { ShieldCheck, Download, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const EXPORT_TABLES = [
  'contacts', 'companies', 'deals', 'activities', 'tasks', 'tickets', 'ticket_comments',
  'quotes', 'quote_items', 'invoices', 'invoice_items', 'automations', 'kb_articles', 'documents',
];

export function Privacy() {
  const { tenant, profile, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = async () => {
    if (!tenant) return;
    setExporting(true);
    const result: Record<string, unknown> = { exported_at: new Date().toISOString(), tenant: tenant.name };
    for (const table of EXPORT_TABLES) {
      const { data } = await supabase.from(table).select('*');
      result[table] = data || [];
    }
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-donnees-${tenant.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const deleteAccount = async () => {
    if (!tenant || confirmName !== tenant.name) return;
    setDeleting(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token || ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ confirmTenantName: confirmName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Échec de la suppression.');
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la suppression.');
      setDeleting(false);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <div>
      <PageHeader title="Confidentialité & Données" subtitle="Conformité RGPD — export et droit à l'oubli" />

      <Card className="p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><Download size={20} /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Exporter toutes vos données</h3>
            <p className="text-sm text-gray-500">Contacts, entreprises, deals, tâches, tickets, devis, factures — au format JSON, portable et lisible.</p>
          </div>
        </div>
        <Button className="mt-4" variant="secondary" onClick={exportData} disabled={exporting}>
          {exporting ? <><Loader2 size={14} className="animate-spin" /> Export en cours…</> : <><Download size={14} /> Télécharger l'export</>}
        </Button>
      </Card>

      <Card className="mt-6 border border-red-100 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-50 p-2.5 text-red-600"><Trash2 size={20} /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Supprimer définitivement le compte</h3>
            <p className="text-sm text-gray-500">Droit à l'oubli : supprime irréversiblement toutes les données du tenant et tous les comptes utilisateurs associés.</p>
          </div>
        </div>
        {isAdmin ? (
          <Button className="mt-4" variant="danger" onClick={() => setDeleteModal(true)}>
            <Trash2 size={14} /> Supprimer le compte
          </Button>
        ) : (
          <p className="mt-4 text-sm text-gray-400">Seul un administrateur peut effectuer cette action.</p>
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
        <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
        Les emails marketing ne sont envoyés qu'aux contacts ayant explicitement donné leur consentement (case à cocher sur chaque fiche contact), conformément au RGPD.
      </div>

      <Modal open={deleteModal} onClose={() => { setDeleteModal(false); setConfirmName(''); setError(null); }} title="Supprimer définitivement le compte" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>Cette action est <b>irréversible</b>. Toutes les données ({tenant?.name}) et tous les comptes utilisateurs seront supprimés définitivement.</span>
          </div>
          <Input
            label={`Tapez "${tenant?.name}" pour confirmer`}
            value={confirmName}
            onChange={e => setConfirmName(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteModal(false)}>Annuler</Button>
            <Button variant="danger" disabled={deleting || confirmName !== tenant?.name} onClick={deleteAccount}>
              {deleting ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
