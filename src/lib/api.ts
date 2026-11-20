import type { HmisDatabase, User } from '../types/hmis';
import { dispatchLocalApi } from './localStore';

export interface ClientHmisState extends Omit<HmisDatabase, 'users'> {
  users: User[];
}

export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  return dispatchLocalApi<T>(url, options);
}

export function downloadRevenueCsv(state: ClientHmisState): void {
  const rows = [
    ['Invoice Number', 'Patient Code', 'Patient Name', 'Issued At', 'Total Amount', 'Amount Paid', 'Status'].join(','),
  ];
  for (const inv of state.invoices) {
    const p = state.patients.find((x) => x.id === inv.patient_id);
    rows.push(
      [
        inv.invoice_number,
        p?.code || '',
        `"${p ? `${p.first_name} ${p.last_name}` : ''}"`,
        inv.issued_at.slice(0, 10),
        inv.total_amount,
        inv.amount_paid,
        inv.status,
      ].join(',')
    );
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `maches-revenue-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatUGX(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  return `UGX ${num.toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calcAge(dob: string | null | undefined): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return `${Math.max(0, age)} yrs`;
}
