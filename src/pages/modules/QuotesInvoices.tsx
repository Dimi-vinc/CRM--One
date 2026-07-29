import { useEffect, useMemo, useState } from 'react';
import { Plus, FileText, Receipt, Printer, Trash2, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Modal, Input, Select, Textarea, Badge, EmptyState } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney, formatDate } from '../../lib/utils';
import { PLATFORM_NAME } from '../../lib/constants';
import { generateDocumentPdf } from '../../lib/pdfDocument';
import type { Quote, QuoteItem, Invoice, InvoiceItem, QuoteStatus, InvoiceStatus, Contact, Company } from '../../lib/types';

const QUOTE_STATUS_COLOR: Record<QuoteStatus, 'gray' | 'blue' | 'green' | 'red' | 'orange'> = {
  draft: 'gray', sent: 'blue', accepted: 'green', rejected: 'red', expired: 'orange',
};
const INVOICE_STATUS_COLOR: Record<InvoiceStatus, 'gray' | 'blue' | 'green' | 'red' | 'orange'> = {
  draft: 'gray', sent: 'blue', paid: 'green', overdue: 'red', cancelled: 'gray',
};

interface DraftLine { description: string; quantity: number; unit_price: number; tax_rate: number; }
const emptyLine = (): DraftLine => ({ description: '', quantity: 1, unit_price: 0, tax_rate: 0 });

function computeTotal(lines: { quantity: number; unit_price: number; tax_rate: number }[]) {
  const subtotal = lines.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax = lines.reduce((s, i) => s + i.quantity * i.unit_price * (i.tax_rate / 100), 0);
  return { subtotal, tax, total: subtotal + tax };
}

export function QuotesInvoices() {
  const { tenant } = useAuth();
  const [tab, setTab] = useState<'quotes' | 'invoices'>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quoteItems, setQuoteItems] = useState<Record<string, QuoteItem[]>>({});
  const [invoiceItems, setInvoiceItems] = useState<Record<string, InvoiceItem[]>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'quote' | 'invoice' | null>(null);

  const [form, setForm] = useState({
    contact_id: '', company_id: '', currency_code: tenant?.currency_code || 'USD',
    notes: '', valid_until: '', due_date: '',
    lines: [emptyLine()] as DraftLine[],
  });

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const [{ data: q }, { data: i }, { data: qi }, { data: ii }, { data: c }, { data: co }] = await Promise.all([
      supabase.from('quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('quote_items').select('*').order('position'),
      supabase.from('invoice_items').select('*').order('position'),
      supabase.from('contacts').select('*').order('first_name'),
      supabase.from('companies').select('*').order('name'),
    ]);
    setQuotes(q || []); setInvoices(i || []);
    const qiMap: Record<string, QuoteItem[]> = {};
    (qi || []).forEach((it: QuoteItem) => { (qiMap[it.quote_id] ||= []).push(it); });
    setQuoteItems(qiMap);
    const iiMap: Record<string, InvoiceItem[]> = {};
    (ii || []).forEach((it: InvoiceItem) => { (iiMap[it.invoice_id] ||= []).push(it); });
    setInvoiceItems(iiMap);
    setContacts(c || []); setCompanies(co || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tenant]);

  const contactName = (id: string | null) => { const c = contacts.find(x => x.id === id); return c ? `${c.first_name} ${c.last_name || ''}`.trim() : '—'; };
  const companyName = (id: string | null) => companies.find(x => x.id === id)?.name || '—';

  const resetForm = () => setForm({ contact_id: '', company_id: '', currency_code: tenant?.currency_code || 'USD', notes: '', valid_until: '', due_date: '', lines: [emptyLine()] });
  const updateLine = (idx: number, patch: Partial<DraftLine>) => setForm(f => ({ ...f, lines: f.lines.map((l, i) => i === idx ? { ...l, ...patch } : l) }));

  const createQuote = async () => {
    if (!tenant) return;
    const number = `DEV-${Date.now().toString().slice(-8)}`;
    const { data: quote, error } = await supabase.from('quotes').insert({
      tenant_id: tenant.id, quote_number: number,
      contact_id: form.contact_id || null, company_id: form.company_id || null,
      currency_code: form.currency_code, notes: form.notes || null, valid_until: form.valid_until || null,
    }).select().single();
    if (error || !quote) return;
    const lines = form.lines.filter(l => l.description.trim());
    if (lines.length) {
      const { data: items } = await supabase.from('quote_items').insert(
        lines.map((l, i) => ({ tenant_id: tenant.id, quote_id: quote.id, ...l, position: i }))
      ).select();
      setQuoteItems(prev => ({ ...prev, [quote.id]: items || [] }));
    }
    setQuotes(prev => [quote, ...prev]);
    setModal(null); resetForm();
  };

  const createInvoice = async () => {
    if (!tenant) return;
    const number = `FAC-${Date.now().toString().slice(-8)}`;
    const { data: invoice, error } = await supabase.from('invoices').insert({
      tenant_id: tenant.id, invoice_number: number,
      contact_id: form.contact_id || null, company_id: form.company_id || null,
      currency_code: form.currency_code, notes: form.notes || null, due_date: form.due_date || null,
    }).select().single();
    if (error || !invoice) return;
    const lines = form.lines.filter(l => l.description.trim());
    if (lines.length) {
      const { data: items } = await supabase.from('invoice_items').insert(
        lines.map((l, i) => ({ tenant_id: tenant.id, invoice_id: invoice.id, ...l, position: i }))
      ).select();
      setInvoiceItems(prev => ({ ...prev, [invoice.id]: items || [] }));
    }
    setInvoices(prev => [invoice, ...prev]);
    setModal(null); resetForm();
  };

  const setQuoteStatus = async (q: Quote, status: QuoteStatus) => {
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status } : x));
    await supabase.from('quotes').update({ status }).eq('id', q.id);
  };
  const setInvoiceStatus = async (inv: Invoice, status: InvoiceStatus) => {
    setInvoices(prev => prev.map(x => x.id === inv.id ? { ...x, status } : x));
    await supabase.from('invoices').update({ status }).eq('id', inv.id);
  };

  // Convert an accepted quote directly into an invoice, copying its line items
  const convertToInvoice = async (q: Quote) => {
    if (!tenant) return;
    const number = `FAC-${Date.now().toString().slice(-8)}`;
    const { data: invoice, error } = await supabase.from('invoices').insert({
      tenant_id: tenant.id, invoice_number: number, quote_id: q.id,
      contact_id: q.contact_id, company_id: q.company_id,
      currency_code: q.currency_code, notes: q.notes,
    }).select().single();
    if (error || !invoice) return;
    const lines = quoteItems[q.id] || [];
    if (lines.length) {
      const { data: items } = await supabase.from('invoice_items').insert(
        lines.map(l => ({ tenant_id: tenant.id, invoice_id: invoice.id, description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate, position: l.position }))
      ).select();
      setInvoiceItems(prev => ({ ...prev, [invoice.id]: items || [] }));
    }
    setInvoices(prev => [invoice, ...prev]);
    setTab('invoices');
  };

  const deleteQuote = async (id: string) => { setQuotes(prev => prev.filter(x => x.id !== id)); await supabase.from('quotes').delete().eq('id', id); };
  const deleteInvoice = async (id: string) => { setInvoices(prev => prev.filter(x => x.id !== id)); await supabase.from('invoices').delete().eq('id', id); };

  const totals = useMemo(() => computeTotal(form.lines), [form.lines]);

  const downloadQuotePdf = (q: Quote) => {
    const items = quoteItems[q.id] || [];
    const pdf = generateDocumentPdf({
      kind: 'Devis', number: q.quote_number, issuedDate: q.created_at,
      dueOrValidLabel: 'Valide jusqu\'au', dueOrValidDate: q.valid_until, status: q.status,
      fromName: PLATFORM_NAME, fromLocation: tenant?.name || '',
      toName: contactName(q.contact_id), toDetail: companyName(q.company_id),
      currency: q.currency_code, items, notes: q.notes,
    });
    pdf.save(`${q.quote_number}.pdf`);
  };

  const downloadInvoicePdf = (inv: Invoice) => {
    const items = invoiceItems[inv.id] || [];
    const pdf = generateDocumentPdf({
      kind: 'Facture', number: inv.invoice_number, issuedDate: inv.created_at,
      dueOrValidLabel: 'Échéance', dueOrValidDate: inv.due_date, status: inv.status,
      fromName: PLATFORM_NAME, fromLocation: tenant?.name || '',
      toName: contactName(inv.contact_id), toDetail: companyName(inv.company_id),
      currency: inv.currency_code, items, notes: inv.notes,
    });
    pdf.save(`${inv.invoice_number}.pdf`);
  };

  return (
    <div>
      <PageHeader
        title="Devis & Factures"
        subtitle="Documents commerciaux pour vos clients"
        actions={<Button onClick={() => setModal(tab === 'quotes' ? 'quote' : 'invoice')}><Plus size={16} /> {tab === 'quotes' ? 'Nouveau devis' : 'Nouvelle facture'}</Button>}
      />

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('quotes')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'quotes' ? 'bg-coral-600 text-white' : 'bg-gray-100 text-gray-600'}`}><FileText size={14} className="mr-1.5 inline" />Devis</button>
        <button onClick={() => setTab('invoices')} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'invoices' ? 'bg-coral-600 text-white' : 'bg-gray-100 text-gray-600'}`}><Receipt size={14} className="mr-1.5 inline" />Factures</button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Card key={i} className="h-16 animate-pulse bg-gray-50" />)}</div>
      ) : tab === 'quotes' ? (
        quotes.length === 0 ? (
          <Card className="p-8"><EmptyState icon={FileText} title="Aucun devis" description="Créez votre premier devis client." action={<Button onClick={() => setModal('quote')}>Créer</Button>} /></Card>
        ) : (
          <div className="space-y-2">
            {quotes.map(q => {
              const { total } = computeTotal(quoteItems[q.id] || []);
              return (
                <Card key={q.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-[140px] flex-1">
                    <p className="text-sm font-semibold text-gray-900">{q.quote_number}</p>
                    <p className="text-xs text-gray-500">{contactName(q.contact_id)} {q.company_id && `· ${companyName(q.company_id)}`}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatMoney(total, q.currency_code)}</p>
                  <Select value={q.status} onChange={e => setQuoteStatus(q, e.target.value as QuoteStatus)} className="w-36">
                    {(['draft', 'sent', 'accepted', 'rejected', 'expired'] as QuoteStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  <Badge color={QUOTE_STATUS_COLOR[q.status]}>{q.status}</Badge>
                  <button onClick={() => downloadQuotePdf(q)} title="Télécharger le PDF" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Printer size={15} /></button>
                  {q.status === 'accepted' && (
                    <button onClick={() => convertToInvoice(q)} title="Convertir en facture" className="rounded-lg p-2 text-mint-600 hover:bg-mint-50"><ArrowRightLeft size={15} /></button>
                  )}
                  <button onClick={() => deleteQuote(q.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </Card>
              );
            })}
          </div>
        )
      ) : invoices.length === 0 ? (
        <Card className="p-8"><EmptyState icon={Receipt} title="Aucune facture" description="Créez votre première facture client." action={<Button onClick={() => setModal('invoice')}>Créer</Button>} /></Card>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => {
            const { total } = computeTotal(invoiceItems[inv.id] || []);
            return (
              <Card key={inv.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
                  <p className="text-xs text-gray-500">{contactName(inv.contact_id)} {inv.company_id && `· ${companyName(inv.company_id)}`}{inv.due_date && ` · échéance ${formatDate(inv.due_date)}`}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">{formatMoney(total, inv.currency_code)}</p>
                <Select value={inv.status} onChange={e => setInvoiceStatus(inv, e.target.value as InvoiceStatus)} className="w-36">
                  {(['draft', 'sent', 'paid', 'overdue', 'cancelled'] as InvoiceStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <Badge color={INVOICE_STATUS_COLOR[inv.status]}>{inv.status}</Badge>
                <button onClick={() => downloadInvoicePdf(inv)} title="Télécharger le PDF" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Printer size={15} /></button>
                <button onClick={() => deleteInvoice(inv.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!modal} onClose={() => { setModal(null); resetForm(); }} title={modal === 'quote' ? 'Nouveau devis' : 'Nouvelle facture'} size="lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Contact" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}>
              <option value="">—</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </Select>
            <Select label="Entreprise" value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}>
              <option value="">—</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>

          <div>
            <p className="label mb-1">Lignes</p>
            <div className="space-y-2">
              {form.lines.map((it, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                  <input className="input col-span-2 sm:col-span-5" placeholder="Description" value={it.description} onChange={e => updateLine(idx, { description: e.target.value })} />
                  <input className="input col-span-1 sm:col-span-2" type="number" min={0} placeholder="Qté" value={it.quantity} onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} />
                  <input className="input col-span-1 sm:col-span-2" type="number" min={0} placeholder="Prix unit." value={it.unit_price} onChange={e => updateLine(idx, { unit_price: Number(e.target.value) })} />
                  <input className="input col-span-1 sm:col-span-2" type="number" min={0} placeholder="Taxe %" value={it.tax_rate} onChange={e => updateLine(idx, { tax_rate: Number(e.target.value) })} />
                  <button className="col-span-1 sm:col-span-1 flex items-center justify-center text-gray-400 hover:text-red-600" onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setForm(f => ({ ...f, lines: [...f.lines, emptyLine()] }))} className="mt-2 text-xs font-medium text-coral-600 hover:underline">+ Ajouter une ligne</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Devise" value={form.currency_code} onChange={e => setForm({ ...form, currency_code: e.target.value.toUpperCase() })} />
            {modal === 'quote' ? (
              <Input label="Valide jusqu'au" type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} />
            ) : (
              <Input label="Échéance" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            )}
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />

          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between text-gray-600"><span>Sous-total</span><span>{formatMoney(totals.subtotal, form.currency_code)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Taxe</span><span>{formatMoney(totals.tax, form.currency_code)}</span></div>
            <div className="flex justify-between font-semibold text-gray-900"><span>Total</span><span>{formatMoney(totals.total, form.currency_code)}</span></div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => { setModal(null); resetForm(); }}>Annuler</Button>
            <Button onClick={modal === 'quote' ? createQuote : createInvoice}>Créer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
