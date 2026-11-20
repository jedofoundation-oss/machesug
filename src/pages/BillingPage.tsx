import React, { useState } from 'react';
import {
  CreditCard,
  Download,
  Plus,
  Printer,
  Receipt,
  Shield,
  Trash2,
} from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, downloadRevenueCsv, formatDate, formatDateTime, formatUGX } from '../lib/api';
import type { Invoice, Payment } from '../types/hmis';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface BillingPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
}

export const BillingPage: React.FC<BillingPageProps> = ({ state, onRefresh }) => {
  const [tab, setTab] = useState<'invoices' | 'receipts' | 'debtors' | 'expenses' | 'insurance' | 'prices'>('invoices');
  const [newInvOpen, setNewInvOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  const [invForm, setInvForm] = useState({
    patient_id: state.patients[0]?.id || '',
    description: 'Outpatient Service Charge',
    unit_price: '20000',
    quantity: '1',
  });

  const [payForm, setPayForm] = useState({
    amount: '',
    payment_method: 'Cash',
    reference: '',
    notes: '',
  });

  const [itemAddForm, setItemAddForm] = useState({
    description: '',
    quantity: '1',
    unit_price: '10000',
  });

  const [expenseForm, setExpenseForm] = useState({
    description: '',
    category: 'Medical Supplies',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
  });

  const [claimForm, setClaimForm] = useState({
    invoice_id: state.invoices[0]?.id || '',
    provider_id: state.insurance_providers[0]?.id || '',
    policy_number: '',
    claim_amount: '30000',
    notes: '',
  });

  const activeInvoices = state.invoices.filter((i) => i.status !== 'Void');
  const totalBilled = activeInvoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalCollected = activeInvoices.reduce((s, i) => s + Number(i.amount_paid), 0);
  const totalExpenses = state.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const debtors = activeInvoices.filter((i) => i.total_amount > i.amount_paid);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: invForm.patient_id,
        items: [
          {
            description: invForm.description,
            quantity: Number(invForm.quantity),
            unit_price: Number(invForm.unit_price),
          },
        ],
      }),
    });
    await onRefresh();
    setNewInvOpen(false);
  };

  const openPayModal = (inv: Invoice) => {
    const balance = Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid));
    setPayInvoice(inv);
    setPayForm({
      amount: String(balance),
      payment_method: state.payment_modes[0] || 'Cash',
      reference: `RCP-${Math.floor(1000 + Math.random() * 8999)}`,
      notes: '',
    });
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvoice) return;
    const res = await apiRequest<{ payment: Payment }>(`/api/invoices/${payInvoice.id}/pay`, {
      method: 'POST',
      body: JSON.stringify(payForm),
    });
    await onRefresh();
    setPayInvoice(null);
    setReceiptPayment(res.payment);
  };

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewInvoice) return;
    await apiRequest(`/api/invoices/${viewInvoice.id}/items`, {
      method: 'POST',
      body: JSON.stringify(itemAddForm),
    });
    await onRefresh();
    setItemAddForm({ description: '', quantity: '1', unit_price: '10000' });
  };

  const handleVoidInvoice = async (inv: Invoice) => {
    await apiRequest(`/api/invoices/${inv.id}/void`, { method: 'POST' });
    await onRefresh();
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expenseForm),
    });
    await onRefresh();
    setExpenseOpen(false);
    setExpenseForm({
      description: '',
      category: 'Medical Supplies',
      amount: '',
      expense_date: new Date().toISOString().slice(0, 10),
    });
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const inv = state.invoices.find((i) => i.id === claimForm.invoice_id);
    await apiRequest('/api/insurance/claims', {
      method: 'POST',
      body: JSON.stringify({
        ...claimForm,
        patient_id: inv?.patient_id || state.patients[0]?.id,
      }),
    });
    await onRefresh();
    setClaimOpen(false);
  };

  const handleUpdatePrice = async (type: string, id: string, price: string) => {
    await apiRequest('/api/prices/update', {
      method: 'POST',
      body: JSON.stringify({ type, id, price: Number(price) }),
    });
    await onRefresh();
  };

  const liveViewInvoice = viewInvoice
    ? state.invoices.find((i) => i.id === viewInvoice.id) || viewInvoice
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Billing, Receipts & Finance</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage patient invoices, collect payments, track debtors, log expenses, and set service tariffs.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => downloadRevenueCsv(state)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setNewInvOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Financial Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Total Billed (Active)</div>
          <div className="text-xl font-semibold text-slate-900 mt-1 font-mono tabular-nums">
            {formatUGX(totalBilled)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Cash & Digital Collected</div>
          <div className="text-xl font-semibold text-emerald-700 mt-1 font-mono tabular-nums">
            {formatUGX(totalCollected)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Outstanding Receivables</div>
          <div className="text-xl font-semibold text-amber-700 mt-1 font-mono tabular-nums">
            {formatUGX(Math.max(0, totalBilled - totalCollected))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Operating Expenses</div>
          <div className="text-xl font-semibold text-rose-700 mt-1 font-mono tabular-nums">
            {formatUGX(totalExpenses)}
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        {[
          { id: 'invoices', label: `Invoices (${state.invoices.length})` },
          { id: 'receipts', label: `Payment Receipts (${state.payments.length})` },
          { id: 'debtors', label: `Debtors (${debtors.length})` },
          { id: 'expenses', label: `Expenses (${state.expenses.length})` },
          { id: 'insurance', label: `Insurance (${state.insurance_claims.length})` },
          { id: 'prices', label: 'Price Tariff' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Issued</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.invoices.map((inv) => {
                  const pat = state.patients.find((p) => p.id === inv.patient_id);
                  const balance = Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid));
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-800">
                        <button
                          type="button"
                          onClick={() => setViewInvoice(inv)}
                          className="text-teal-700 hover:underline font-medium"
                        >
                          {inv.invoice_number}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                        {formatDate(inv.issued_at)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {formatUGX(inv.total_amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                        {formatUGX(inv.amount_paid)}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={inv.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status !== 'Paid' && inv.status !== 'Void' && balance > 0 && (
                            <button
                              type="button"
                              onClick={() => openPayModal(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 rounded whitespace-nowrap"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Receive Payment</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewInvoice(inv)}
                            className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                          >
                            Items
                          </button>
                          {inv.status !== 'Void' && inv.amount_paid === 0 && (
                            <button
                              type="button"
                              onClick={() => handleVoidInvoice(inv)}
                              className="px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'receipts' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Reference</th>
                <th className="py-2.5 px-4">Invoice</th>
                <th className="py-2.5 px-4">Patient</th>
                <th className="py-2.5 px-4">Method</th>
                <th className="py-2.5 px-4">Paid At</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.payments.map((pay) => {
                const inv = state.invoices.find((i) => i.id === pay.invoice_id);
                const pat = state.patients.find((p) => p.id === inv?.patient_id);
                return (
                  <tr key={pay.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-700">
                      {pay.reference || pay.id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">
                      {inv?.invoice_number || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{pay.payment_method}</td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                      {formatDateTime(pay.paid_at)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                      {formatUGX(pay.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setReceiptPayment(pay)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'debtors' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Patient</th>
                <th className="py-2.5 px-4">Phone</th>
                <th className="py-2.5 px-4">Invoice</th>
                <th className="py-2.5 px-4 text-right">Total</th>
                <th className="py-2.5 px-4 text-right">Balance Due</th>
                <th className="py-2.5 px-4 text-right">Collect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {debtors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No outstanding patient balances.
                  </td>
                </tr>
              ) : (
                debtors.map((inv) => {
                  const pat = state.patients.find((p) => p.id === inv.patient_id);
                  const bal = inv.total_amount - inv.amount_paid;
                  return (
                    <tr key={inv.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{pat?.phone || '—'}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">{inv.invoice_number}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {formatUGX(inv.total_amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-rose-700 tabular-nums">
                        {formatUGX(bal)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openPayModal(inv)}
                          className="px-2.5 py-1 text-xs font-medium bg-teal-600 text-white rounded"
                        >
                          Pay Balance
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setExpenseOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Expense</span>
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="py-2.5 px-4 text-slate-600 tabular-nums">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{exp.category}</td>
                    <td className="py-2.5 px-4 text-slate-700">{exp.description}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-rose-700 tabular-nums">
                      {formatUGX(exp.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/expenses/${exp.id}`, { method: 'DELETE' });
                          await onRefresh();
                        }}
                        className="p-1 text-slate-400 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'insurance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Insurance Providers & Claims</h3>
            <button
              type="button"
              onClick={() => setClaimOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Submit Claim</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {state.insurance_providers.map((prov) => (
              <div key={prov.id} className="bg-white border border-slate-200 rounded-lg p-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-slate-900">{prov.name}</div>
                  <span className="font-mono text-teal-700 font-semibold">
                    {prov.coverage_percent}% Coverage
                  </span>
                </div>
                <div className="text-slate-500 mt-1">
                  Contact: {prov.contact_person} · {prov.phone} · {prov.email}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Provider</th>
                  <th className="py-2.5 px-4">Policy #</th>
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4 text-right">Claimed</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.insurance_claims.map((cl) => {
                  const prov = state.insurance_providers.find((p) => p.id === cl.provider_id);
                  const pat = state.patients.find((p) => p.id === cl.patient_id);
                  return (
                    <tr key={cl.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{prov?.name}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">{cl.policy_number}</td>
                      <td className="py-2.5 px-4 text-slate-800">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {formatUGX(cl.claim_amount)}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={cl.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {cl.status === 'Submitted' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/insurance/claims/${cl.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({
                                  status: 'Approved',
                                  approved_amount: cl.claim_amount,
                                }),
                              });
                              await onRefresh();
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white rounded"
                          >
                            Mark Approved
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'prices' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Doctor Consultation Fees</h3>
            {state.doctors.map((d) => {
              const u = state.users.find((x) => x.id === d.user_id);
              return (
                <PriceRow
                  key={d.id}
                  label={`Dr. ${u?.full_name || d.id}`}
                  value={d.consultation_fee}
                  onSave={(val) => handleUpdatePrice('doctor', d.id, val)}
                />
              );
            })}
            <h3 className="text-sm font-semibold text-slate-900 pt-3 border-t border-slate-100">
              Inpatient Bed Daily Rents
            </h3>
            {state.beds.map((b) => (
              <PriceRow
                key={b.id}
                label={`Bed ${b.bed_number}`}
                value={b.daily_rent}
                onSave={(val) => handleUpdatePrice('bed', b.id, val)}
              />
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Lab & Radiology Tariffs</h3>
            {state.lab_tests.map((t) => (
              <PriceRow
                key={t.id}
                label={`Lab: ${t.name}`}
                value={t.price}
                onSave={(val) => handleUpdatePrice('lab', t.id, val)}
              />
            ))}
            {state.radiology_scans.map((s) => (
              <PriceRow
                key={s.id}
                label={`Scan: ${s.name}`}
                value={s.price}
                onSave={(val) => handleUpdatePrice('radiology', s.id, val)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Invoice Detail & Line Items Modal */}
      <Modal
        open={Boolean(liveViewInvoice)}
        onClose={() => setViewInvoice(null)}
        title={liveViewInvoice ? `Invoice ${liveViewInvoice.invoice_number}` : ''}
        subtitle={
          liveViewInvoice
            ? `Issued ${formatDateTime(liveViewInvoice.issued_at)} · Status: ${liveViewInvoice.status}`
            : undefined
        }
        maxWidthClass="max-w-2xl"
      >
        {liveViewInvoice && (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {state.invoice_items
                    .filter((it) => it.invoice_id === liveViewInvoice.id)
                    .map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-3 text-slate-800">{it.description}</td>
                        <td className="py-2 px-3 text-right font-mono">{it.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatUGX(it.unit_price)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          {formatUGX(it.total_price)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between text-xs bg-slate-50 border border-slate-200 rounded p-3 tabular-nums">
              <div>
                <span className="text-slate-500">Total Billed:</span>{' '}
                <span className="font-mono font-semibold text-slate-900">
                  {formatUGX(liveViewInvoice.total_amount)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Paid:</span>{' '}
                <span className="font-mono font-semibold text-emerald-700">
                  {formatUGX(liveViewInvoice.amount_paid)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Balance:</span>{' '}
                <span className="font-mono font-semibold text-rose-700">
                  {formatUGX(Math.max(0, liveViewInvoice.total_amount - liveViewInvoice.amount_paid))}
                </span>
              </div>
            </div>

            {liveViewInvoice.status !== 'Void' && (
              <form onSubmit={handleAddLineItem} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                <input
                  required
                  value={itemAddForm.description}
                  onChange={(e) => setItemAddForm({ ...itemAddForm, description: e.target.value })}
                  placeholder="Add service/item..."
                  className="sm:col-span-2 px-2.5 py-1.5 text-xs border border-slate-200 rounded"
                />
                <input
                  type="number"
                  required
                  value={itemAddForm.unit_price}
                  onChange={(e) => setItemAddForm({ ...itemAddForm, unit_price: e.target.value })}
                  placeholder="Unit price"
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded"
                >
                  + Add Item
                </button>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={Boolean(payInvoice)}
        onClose={() => setPayInvoice(null)}
        title="Record Payment"
        subtitle={payInvoice ? `Invoice ${payInvoice.invoice_number}` : undefined}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Amount (UGX) *</label>
              <input
                type="number"
                required
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Method</label>
              <select
                value={payForm.payment_method}
                onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
              >
                {state.payment_modes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Transaction / Receipt Reference
            </label>
            <input
              value={payForm.reference}
              onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <input
              value={payForm.notes}
              onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPayInvoice(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-md"
            >
              Confirm Payment & Issue Receipt
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Payment Receipt Modal */}
      <Modal
        open={Boolean(receiptPayment)}
        onClose={() => setReceiptPayment(null)}
        title="Official Payment Receipt"
      >
        {receiptPayment &&
          (() => {
            const inv = state.invoices.find((i) => i.id === receiptPayment.invoice_id);
            const pat = state.patients.find((p) => p.id === inv?.patient_id);
            return (
              <div className="space-y-4 text-xs">
                <div className="border border-slate-200 rounded-md p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <div className="text-base font-bold text-slate-900">MachesHMS</div>
                      <div className="text-slate-500">MachesUg Hospital Cash Office</div>
                    </div>
                    <Receipt className="w-6 h-6 text-teal-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">Receipt #:</span>{' '}
                      <span className="font-mono font-semibold">{receiptPayment.reference}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Date:</span>{' '}
                      <span className="tabular-nums">{formatDateTime(receiptPayment.paid_at)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Patient:</span>{' '}
                      <span className="font-medium">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Patient'} ({pat?.code})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Invoice:</span>{' '}
                      <span className="font-mono">{inv?.invoice_number}</span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-3 flex items-center justify-between">
                    <span className="font-medium text-emerald-900">
                      Amount Received ({receiptPayment.payment_method})
                    </span>
                    <span className="text-base font-mono font-bold text-emerald-800 tabular-nums">
                      {formatUGX(receiptPayment.amount)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                </div>
              </div>
            );
          })()}
      </Modal>

      {/* Create Invoice Modal */}
      <Modal open={newInvOpen} onClose={() => setNewInvOpen(false)} title="Create Patient Invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Patient *</label>
            <select
              value={invForm.patient_id}
              onChange={(e) => setInvForm({ ...invForm, patient_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description *</label>
            <input
              required
              value={invForm.description}
              onChange={(e) => setInvForm({ ...invForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unit Price (UGX)
              </label>
              <input
                type="number"
                required
                value={invForm.unit_price}
                onChange={(e) => setInvForm({ ...invForm, unit_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                required
                value={invForm.quantity}
                onChange={(e) => setInvForm({ ...invForm, quantity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setNewInvOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Generate Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Expense Modal */}
      <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Log Hospital Expense">
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description *</label>
            <input
              required
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Medical Supplies">Medical Supplies</option>
                <option value="Utilities">Utilities</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Staff Welfare">Staff Welfare</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Amount (UGX) *</label>
              <input
                type="number"
                required
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={expenseForm.expense_date}
              onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setExpenseOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md"
            >
              Save Expense
            </button>
          </div>
        </form>
      </Modal>

      {/* Insurance Claim Modal */}
      <Modal open={claimOpen} onClose={() => setClaimOpen(false)} title="Submit Insurance Claim">
        <form onSubmit={handleCreateClaim} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Provider</label>
            <select
              value={claimForm.provider_id}
              onChange={(e) => setClaimForm({ ...claimForm, provider_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.insurance_providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Invoice</label>
            <select
              value={claimForm.invoice_id}
              onChange={(e) => setClaimForm({ ...claimForm, invoice_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} ({formatUGX(i.total_amount)})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Policy # *</label>
              <input
                required
                value={claimForm.policy_number}
                onChange={(e) => setClaimForm({ ...claimForm, policy_number: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Claim Amount (UGX) *
              </label>
              <input
                type="number"
                required
                value={claimForm.claim_amount}
                onChange={(e) => setClaimForm({ ...claimForm, claim_amount: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setClaimOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Submit Claim
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const PriceRow: React.FC<{
  label: string;
  value: number;
  onSave: (v: string) => Promise<void>;
}> = ({ label, value, onSave }) => {
  const [val, setVal] = useState(String(value));
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-700 truncate">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-28 px-2 py-1 border border-slate-200 rounded font-mono text-right"
        />
        <button
          type="button"
          onClick={async () => {
            await onSave(val);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
          className="px-2.5 py-1 bg-slate-900 text-white rounded hover:bg-slate-800 whitespace-nowrap"
        >
          {saved ? 'Saved' : 'Update'}
        </button>
      </div>
    </div>
  );
};
