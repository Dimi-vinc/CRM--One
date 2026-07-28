import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney, formatDate } from './utils';
import type { LineItem } from './types';

interface DocData {
  kind: 'Devis' | 'Facture';
  number: string;
  issuedDate: string;
  dueOrValidLabel: string;
  dueOrValidDate: string | null;
  status: string;
  fromName: string;
  fromLocation: string;
  toName: string;
  toDetail: string;
  currency: string;
  items: LineItem[];
  notes: string | null;
}

function computeTotals(items: LineItem[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax = items.reduce((s, i) => s + i.quantity * i.unit_price * (i.tax_rate / 100), 0);
  return { subtotal, tax, total: subtotal + tax };
}

export function generateDocumentPdf(doc: DocData): jsPDF {
  const pdf = new jsPDF();
  const currency = doc.currency;

  pdf.setFontSize(20);
  pdf.setTextColor(236, 74, 12); // coral brand color
  pdf.text(doc.kind, 14, 20);

  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.text(`N° ${doc.number}`, 14, 27);
  pdf.text(`Statut : ${doc.status}`, 14, 32);

  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(11);
  pdf.text(doc.fromName, 140, 20);
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text(doc.fromLocation, 140, 25);

  pdf.setFontSize(9);
  pdf.text(`Émis le : ${formatDate(doc.issuedDate)}`, 14, 42);
  if (doc.dueOrValidDate) pdf.text(`${doc.dueOrValidLabel} : ${formatDate(doc.dueOrValidDate)}`, 14, 47);

  pdf.setFontSize(10);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Destinataire :', 14, 57);
  pdf.setFontSize(11);
  pdf.text(doc.toName, 14, 63);
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text(doc.toDetail, 14, 68);

  const { subtotal, tax, total } = computeTotals(doc.items);

  autoTable(pdf, {
    startY: 78,
    head: [['Description', 'Qté', 'Prix unitaire', 'TVA', 'Total']],
    body: doc.items.map(i => [
      i.description,
      String(i.quantity),
      formatMoney(i.unit_price, currency),
      `${i.tax_rate}%`,
      formatMoney(i.quantity * i.unit_price * (1 + i.tax_rate / 100), currency),
    ]),
    headStyles: { fillColor: [236, 74, 12] },
    styles: { fontSize: 9 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (pdf as any).lastAutoTable?.finalY || 90;
  pdf.setFontSize(9);
  pdf.text(`Sous-total : ${formatMoney(subtotal, currency)}`, 140, finalY + 8);
  pdf.text(`TVA : ${formatMoney(tax, currency)}`, 140, finalY + 13);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Total : ${formatMoney(total, currency)}`, 140, finalY + 20);
  pdf.setFont('helvetica', 'normal');

  if (doc.notes) {
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Notes :', 14, finalY + 30);
    pdf.text(pdf.splitTextToSize(doc.notes, 180), 14, finalY + 35);
  }

  return pdf;
}
