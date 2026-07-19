import { useRef, useState } from 'react';
import { Upload, Download, FileSpreadsheet, FileDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { downloadCsv } from '../../lib/utils';
import type { Contact } from '../../lib/types';

export function ImportExport() {
  const { tenant } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [imported, setImported] = useState(0);

  const exportContacts = async () => {
    const { data } = await supabase.from('contacts').select('*');
    const rows: (string | number)[][] = [['Prénom','Nom','Email','Téléphone','Ville','Pays']];
    (data as Contact[] || []).forEach(c => rows.push([c.first_name, c.last_name || '', c.email || '', c.phone || '', c.city || '', c.country_code || '']));
    downloadCsv('contacts-export.csv', rows);
  };

  const exportCompanies = async () => {
    const { data } = await supabase.from('companies').select('*');
    const rows: (string | number)[][] = [['Nom','Secteur','Email','Téléphone','Site','Ville','Pays']];
    (data || []).forEach(c => rows.push([c.name, c.industry || '', c.email || '', c.phone || '', c.website || '', c.city || '', c.country_code || '']));
    downloadCsv('companies-export.csv', rows);
  };

  const exportDeals = async () => {
    const { data } = await supabase.from('deals').select('*');
    const rows: (string | number)[][] = [['Titre','Montant','Devise','Étape','Échéance']];
    (data || []).forEach(d => rows.push([d.title, d.amount, d.currency_code, d.stage, d.expected_close_date || '']));
    downloadCsv('deals-export.csv', rows);
  };

  const importCsv = async (file: File) => {
    if (!tenant) return;
    setStatus('Lecture du fichier…');
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const [header, ...rows] = lines;
    const cols = header.split(',').map(h => h.trim().toLowerCase());
    const contacts: any[] = [];
    rows.forEach(r => {
      const vals = r.split(',');
      const obj: any = { tenant_id: tenant.id };
      cols.forEach((c, i) => {
        if (c.includes('prénom') || c === 'first_name') obj.first_name = vals[i];
        else if (c.includes('nom') || c === 'last_name') obj.last_name = vals[i];
        else if (c === 'email') obj.email = vals[i];
        else if (c === 'phone' || c.includes('téléphone')) obj.phone = vals[i];
        else if (c === 'city' || c === 'ville') obj.city = vals[i];
        else if (c.includes('pays') || c === 'country_code') obj.country_code = vals[i];
      });
      if (obj.first_name) contacts.push(obj);
    });
    setStatus(`Import de ${contacts.length} contacts…`);
    const { error } = await supabase.from('contacts').insert(contacts);
    if (error) setStatus(`Erreur: ${error.message}`);
    else { setImported(contacts.length); setStatus(`${contacts.length} contacts importés.`); }
  };

  return (
    <div>
      <PageHeader title="Import / Export" subtitle="Importez et exportez vos données en CSV" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><Download size={22} /></div>
            <div><h3 className="font-semibold text-gray-900">Exporter</h3><p className="text-sm text-gray-500">Téléchargez vos données en CSV.</p></div>
          </div>
          <div className="mt-4 space-y-2">
            <Button variant="secondary" className="w-full justify-start" onClick={exportContacts}><FileDown size={16} /> Exporter les contacts</Button>
            <Button variant="secondary" className="w-full justify-start" onClick={exportCompanies}><FileDown size={16} /> Exporter les entreprises</Button>
            <Button variant="secondary" className="w-full justify-start" onClick={exportDeals}><FileDown size={16} /> Exporter les deals</Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-coral-50 p-2.5 text-coral-700"><Upload size={22} /></div>
            <div><h3 className="font-semibold text-gray-900">Importer</h3><p className="text-sm text-gray-500">CSV : Prénom, Nom, Email, Téléphone, Ville, Pays</p></div>
          </div>
          <div className="mt-4">
            <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center hover:border-coral-400 transition">
              <FileSpreadsheet size={28} className="mx-auto text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">Cliquez pour sélectionner un CSV</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && importCsv(e.target.files[0])} />
              <Button variant="secondary" className="mt-3" onClick={() => fileRef.current?.click()}>Choisir un fichier</Button>
            </div>
            {status && <p className="mt-3 text-sm text-gray-700">{status}</p>}
            {imported > 0 && <p className="mt-1 text-xs text-mint-700">Import réussi.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
