import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { Upload, Download, FileSpreadsheet, FileDown, AlertTriangle, CheckCircle2, RotateCcw, FileWarning } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Select } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { downloadCsv } from '../../lib/utils';
import { CURRENCY_BY_CODE } from '../../lib/constants';
import { CONTACT_FIELDS, COMPANY_FIELDS, DEAL_FIELDS, VALID_STAGE_IDS, guessMapping, type ImportField } from '../../lib/importSchemas';
import type { Contact, Company, Deal } from '../../lib/types';

type EntityKey = 'contacts' | 'companies' | 'deals';

const ENTITY_CONFIG: Record<EntityKey, { label: string; table: string; fields: ImportField[] }> = {
  contacts: { label: 'Contacts', table: 'contacts', fields: CONTACT_FIELDS },
  companies: { label: 'Entreprises', table: 'companies', fields: COMPANY_FIELDS },
  deals: { label: 'Deals', table: 'deals', fields: DEAL_FIELDS },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses a number from a CSV cell that may use either thousands-separator convention
 * (US: "1,234.56" or European: "1.234,56"), or none at all ("1234.56" / "1234,56").
 * The previous implementation only replaced the FIRST comma with a dot, which broke on any
 * value that actually had a thousands separator in either convention (e.g. "12,500.00" became
 * "12.500.00" → NaN), silently rejecting valid deal amounts as "invalid" during import.
 */
function parseLocaleNumber(raw: string): number {
  let s = raw.replace(/[^\d.,-]/g, '').trim();
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Both separators present: whichever appears LAST is the decimal separator.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // Only commas: a single comma followed by 1-2 digits is almost certainly a decimal
    // separator ("12,5" = 12.5); anything else (e.g. "12,500" or multiple commas) is thousands
    // separators to strip.
    const parts = s.split(',');
    s = parts.length === 2 && parts[1].length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (lastDot > -1) {
    // Only dots: more than one means they're thousands separators — keep just the last as decimal.
    const parts = s.split('.');
    if (parts.length > 2) { const dec = parts.pop(); s = parts.join('') + '.' + dec; }
  }
  return Number(s);
}

interface RowResult {
  rowIndex: number;
  ok: boolean;
  reason?: string;
  data?: Record<string, unknown>;
}

export function ImportExport() {
  const { tenant } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [entity, setEntity] = useState<EntityKey>('contacts');
  const [step, setStep] = useState<'upload' | 'mapping' | 'result'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);

  const config = ENTITY_CONFIG[entity];

  const resetImport = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setParseError(null);
    setResults([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const switchEntity = (e: EntityKey) => {
    setEntity(e);
    resetImport();
  };

  // ---- Export (uses downloadCsv, which properly escapes commas/quotes/newlines and adds a UTF-8 BOM for Excel) ----
  const exportContacts = async () => {
    const { data } = await supabase.from('contacts').select('*');
    const out: (string | number)[][] = [['Prénom', 'Nom', 'Email', 'Téléphone', 'Ville', 'Pays']];
    (data as Contact[] || []).forEach(c => out.push([c.first_name, c.last_name || '', c.email || '', c.phone || '', c.city || '', c.country_code || '']));
    downloadCsv('contacts-export.csv', out);
  };
  const exportCompanies = async () => {
    const { data } = await supabase.from('companies').select('*');
    const out: (string | number)[][] = [['Nom', 'Secteur', 'Email', 'Téléphone', 'Site', 'Ville', 'Pays']];
    (data as Company[] || []).forEach(c => out.push([c.name, c.industry || '', c.email || '', c.phone || '', c.website || '', c.city || '', c.country_code || '']));
    downloadCsv('companies-export.csv', out);
  };
  const exportDeals = async () => {
    const { data } = await supabase.from('deals').select('*');
    const out: (string | number)[][] = [['Titre', 'Montant', 'Devise', 'Étape', 'Échéance']];
    (data as Deal[] || []).forEach(d => out.push([d.title, d.amount, d.currency_code, d.stage, d.expected_close_date || '']));
    downloadCsv('deals-export.csv', out);
  };

  const downloadTemplate = () => {
    const header = config.fields.map(f => f.label);
    downloadCsv(`modele-${entity}.csv`, [header]);
  };

  // ---- Import: parse ----
  const onFileSelected = (file: File) => {
    setParseError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        if (res.errors?.length) {
          setParseError(`Erreur de lecture du CSV : ${res.errors[0].message} (ligne ${res.errors[0].row ?? '?'})`);
          return;
        }
        const fields = res.meta.fields || [];
        if (fields.length === 0 || res.data.length === 0) {
          setParseError('Le fichier semble vide ou mal formaté.');
          return;
        }
        setHeaders(fields);
        setRows(res.data);
        setMapping(guessMapping(fields, config.fields));
        setStep('mapping');
      },
      error: (err) => setParseError(err.message),
    });
  };

  const requiredMissing = useMemo(
    () => config.fields.filter(f => f.required && !mapping[f.key]),
    [config.fields, mapping]
  );

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const buildRecord = (row: Record<string, string>): { record: Record<string, unknown>; error?: string } => {
    const record: Record<string, unknown> = { tenant_id: tenant?.id };
    for (const field of config.fields) {
      const header = mapping[field.key];
      const raw = header ? (row[header] ?? '').trim() : '';
      if (field.required && !raw) return { record, error: `${field.label} manquant` };
      if (!raw) continue;

      switch (field.type) {
        case 'email':
          if (!EMAIL_RE.test(raw)) return { record, error: `Email invalide : "${raw}"` };
          record[field.key] = raw;
          break;
        case 'number': {
          const n = parseLocaleNumber(raw);
          if (Number.isNaN(n)) return { record, error: `Montant invalide : "${raw}"` };
          record[field.key] = n;
          break;
        }
        case 'currency': {
          const code = raw.toUpperCase();
          record.currency_code = CURRENCY_BY_CODE[code] ? code : (tenant?.currency_code || 'USD');
          break;
        }
        case 'stage': {
          const s = raw.toLowerCase();
          record.stage = (VALID_STAGE_IDS as Set<string>).has(s) ? s : 'lead';
          break;
        }
        default:
          record[field.key] = raw;
      }
    }
    if (entity === 'deals' && !record.currency_code) record.currency_code = tenant?.currency_code || 'USD';
    if (entity === 'deals' && !record.stage) record.stage = 'lead';
    return { record };
  };

  const runImport = async () => {
    if (!tenant || requiredMissing.length > 0) return;
    setImporting(true);

    // Pre-fetch contacts/companies once for deal linking by email/name
    let contactsByEmail = new Map<string, string>();
    let companiesByName = new Map<string, string>();
    if (entity === 'deals') {
      const [{ data: cs }, { data: cos }] = await Promise.all([
        supabase.from('contacts').select('id,email').eq('tenant_id', tenant.id),
        supabase.from('companies').select('id,name').eq('tenant_id', tenant.id),
      ]);
      contactsByEmail = new Map((cs || []).filter((c: { email?: string }) => c.email).map((c: { id: string; email: string }) => [c.email.toLowerCase(), c.id]));
      companiesByName = new Map((cos || []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id]));
    }

    const prepared: { rowIndex: number; record?: Record<string, unknown>; error?: string }[] = rows.map((row, i) => {
      const { record, error } = buildRecord(row);
      if (error) return { rowIndex: i, error };
      if (entity === 'deals') {
        const email = (record.contact_email as string | undefined)?.toLowerCase();
        const companyName = (record.company_name as string | undefined)?.toLowerCase();
        delete record.contact_email;
        delete record.company_name;
        record.contact_id = email ? contactsByEmail.get(email) || null : null;
        record.company_id = companyName ? companiesByName.get(companyName) || null : null;
        record.owner_id = null;
      }
      return { rowIndex: i, record };
    });

    const toInsert = prepared.filter((p): p is { rowIndex: number; record: Record<string, unknown> } => !!p.record);
    const preErrors: RowResult[] = prepared
      .filter(p => p.error)
      .map(p => ({ rowIndex: p.rowIndex, ok: false, reason: p.error }));

    // Insert with limited concurrency, row by row, so each row's outcome (incl. DB constraint errors) is reported precisely
    const CONCURRENCY = 10;
    const dbResults: RowResult[] = [];
    for (let i = 0; i < toInsert.length; i += CONCURRENCY) {
      const batch = toInsert.slice(i, i + CONCURRENCY);
      const outcomes = await Promise.all(batch.map(async (item) => {
        const { error } = await supabase.from(config.table).insert(item.record);
        return { rowIndex: item.rowIndex, ok: !error, reason: error?.message, data: item.record } as RowResult;
      }));
      dbResults.push(...outcomes);
    }

    const all = [...preErrors, ...dbResults].sort((a, b) => a.rowIndex - b.rowIndex);
    setResults(all);
    setImporting(false);
    setStep('result');
  };

  const downloadErrorReport = () => {
    const failed = results.filter(r => !r.ok);
    const out: (string | number)[][] = [['Ligne', 'Raison']];
    failed.forEach(f => out.push([f.rowIndex + 2, f.reason || 'Erreur inconnue'])); // +2: header row + 0-index
    downloadCsv(`erreurs-import-${entity}.csv`, out);
  };

  const successCount = results.filter(r => r.ok).length;
  const failCount = results.length - successCount;

  return (
    <div>
      <PageHeader title="Import / Export" subtitle="Importez et exportez vos données en CSV, avec mapping de colonnes et rapport d'erreurs" />

      <div className="mb-4 flex gap-2">
        {(Object.keys(ENTITY_CONFIG) as EntityKey[]).map(k => (
          <button
            key={k}
            onClick={() => switchEntity(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${entity === k ? 'bg-coral-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {ENTITY_CONFIG[k].label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-mint-50 p-2.5 text-mint-700"><Download size={22} /></div>
            <div><h3 className="font-semibold text-gray-900">Exporter</h3><p className="text-sm text-gray-500">Téléchargez vos données en CSV (compatible Excel).</p></div>
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
            <div className="flex-1"><h3 className="font-semibold text-gray-900">Importer des {config.label.toLowerCase()}</h3><p className="text-sm text-gray-500">CSV avec en-têtes ; le mapping de colonnes se fait à l'étape suivante.</p></div>
            <button onClick={downloadTemplate} className="text-xs text-coral-600 hover:underline whitespace-nowrap">Modèle CSV</button>
          </div>

          {step === 'upload' && (
            <div className="mt-4">
              <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center hover:border-coral-400 transition">
                <FileSpreadsheet size={28} className="mx-auto text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Cliquez pour sélectionner un CSV</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => e.target.files?.[0] && onFileSelected(e.target.files[0])} />
                <Button variant="secondary" className="mt-3" onClick={() => fileRef.current?.click()}>Choisir un fichier</Button>
              </div>
              {parseError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /><span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {step === 'mapping' && (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-gray-500">{rows.length} ligne(s) détectée(s). Associez vos colonnes aux champs {config.label.toLowerCase()} :</p>
              <div className="space-y-2">
                {config.fields.map(f => (
                  <div key={f.key} className="grid grid-cols-2 items-center gap-2">
                    <span className="text-sm text-gray-700">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                    <Select value={mapping[f.key] || ''} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}>
                      <option value="">— Ignorer —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </Select>
                  </div>
                ))}
              </div>

              {previewRows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>{config.fields.map(f => <th key={f.key} className="px-2 py-1.5 text-left font-medium">{f.label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {previewRows.map((r, i) => (
                        <tr key={i}>
                          {config.fields.map(f => <td key={f.key} className="px-2 py-1.5 text-gray-600">{mapping[f.key] ? r[mapping[f.key]] : '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="bg-gray-50 px-2 py-1 text-[11px] text-gray-400">Aperçu des 5 premières lignes sur {rows.length}.</p>
                </div>
              )}

              {requiredMissing.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>Champ(s) obligatoire(s) non mappé(s) : {requiredMissing.map(f => f.label).join(', ')}</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={resetImport}>Annuler</Button>
                <Button onClick={runImport} disabled={importing || requiredMissing.length > 0}>
                  {importing ? 'Import en cours…' : `Importer ${rows.length} ligne(s)`}
                </Button>
              </div>
            </div>
          )}

          {step === 'result' && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-mint-50 p-3 text-center">
                  <CheckCircle2 size={18} className="mx-auto text-mint-600" />
                  <p className="mt-1 text-lg font-bold text-mint-700">{successCount}</p>
                  <p className="text-xs text-mint-700">importé(s)</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center">
                  <FileWarning size={18} className="mx-auto text-red-600" />
                  <p className="mt-1 text-lg font-bold text-red-700">{failCount}</p>
                  <p className="text-xs text-red-700">échec(s)</p>
                </div>
              </div>

              {failCount > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500"><tr><th className="px-2 py-1.5 text-left">Ligne</th><th className="px-2 py-1.5 text-left">Raison</th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {results.filter(r => !r.ok).map(r => (
                        <tr key={r.rowIndex}><td className="px-2 py-1.5 text-gray-500">{r.rowIndex + 2}</td><td className="px-2 py-1.5 text-red-600">{r.reason}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {failCount > 0 && <Button variant="secondary" onClick={downloadErrorReport}><FileDown size={14} /> Rapport d'erreurs (CSV)</Button>}
                <Button onClick={resetImport}><RotateCcw size={14} /> Nouvel import</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
