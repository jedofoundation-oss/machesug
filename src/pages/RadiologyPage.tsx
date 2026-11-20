import React, { useState } from 'react';
import { CheckCircle2, FileText, Plus, ScanLine } from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDateTime, formatUGX } from '../lib/api';
import type { RadiologyOrder } from '../types/hmis';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface RadiologyPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
}

export const RadiologyPage: React.FC<RadiologyPageProps> = ({ state, onRefresh }) => {
  const [tab, setTab] = useState<'orders' | 'catalog'>('orders');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newScanOpen, setNewScanOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<RadiologyOrder | null>(null);
  const [reportNotes, setReportNotes] = useState('');

  const [orderForm, setOrderForm] = useState({
    patient_id: state.patients[0]?.id || '',
    scan_id: state.radiology_scans[0]?.id || '',
  });
  const [scanForm, setScanForm] = useState({
    name: '',
    price: '50000',
  });

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/radiology/orders', {
      method: 'POST',
      body: JSON.stringify(orderForm),
    });
    await onRefresh();
    setNewOrderOpen(false);
  };

  const handleCreateScan = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/radiology/scans', {
      method: 'POST',
      body: JSON.stringify(scanForm),
    });
    await onRefresh();
    setNewScanOpen(false);
    setScanForm({ name: '', price: '50000' });
  };

  const handleOrderAction = async (order: RadiologyOrder, action: 'perform' | 'approve') => {
    await apiRequest(`/api/radiology/orders/${order.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        action,
        report_notes: activeOrder ? reportNotes : order.report_notes || 'Imaging completed; no acute abnormality.',
      }),
    });
    await onRefresh();
    setActiveOrder(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Radiology & Medical Imaging</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Schedule X-Rays, CT, and MRI studies, capture imaging reports, and approve findings.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setNewScanOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scan Type</span>
          </button>
          <button
            type="button"
            onClick={() => setNewOrderOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md whitespace-nowrap"
          >
            <ScanLine className="w-4 h-4" />
            <span>Order Imaging</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            tab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Imaging Orders ({state.radiology_orders.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('catalog')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            tab === 'catalog' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Scan Catalog ({state.radiology_scans.length})
        </button>
      </div>

      {tab === 'catalog' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Scan Modality</th>
                <th className="py-2.5 px-4 text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.radiology_scans.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{s.name}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatUGX(s.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Scan Requested</th>
                  <th className="py-2.5 px-4">Ordered At</th>
                  <th className="py-2.5 px-4">Radiologist Findings</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.radiology_orders.map((o) => {
                  const pat = state.patients.find((p) => p.id === o.patient_id);
                  const scan = state.radiology_scans.find((s) => s.id === o.scan_id);
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">{scan?.name || 'Scan'}</td>
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                        {formatDateTime(o.ordered_at)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                        {o.report_notes || 'Pending capture'}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={o.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {o.status === 'Scheduled' && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveOrder(o);
                                setReportNotes(o.report_notes || '');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 rounded whitespace-nowrap"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Perform & Report</span>
                            </button>
                          )}
                          {(o.status === 'Performed' || o.status === 'ReportDraft') && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveOrder(o);
                                setReportNotes(o.report_notes || '');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve Report</span>
                            </button>
                          )}
                          {o.status === 'Approved' && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveOrder(o);
                                setReportNotes(o.report_notes || '');
                              }}
                              className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded"
                            >
                              View Report
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

      {/* Radiology Report Modal */}
      <Modal
        open={Boolean(activeOrder)}
        onClose={() => setActiveOrder(null)}
        title="Radiology Findings & Approval"
      >
        {activeOrder && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Radiology Report Findings
              </label>
              <textarea
                rows={4}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Normal cardiothoracic ratio, clear lung fields..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Close
              </button>
              {activeOrder.status === 'Scheduled' && (
                <button
                  type="button"
                  onClick={() => handleOrderAction(activeOrder, 'perform')}
                  className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
                >
                  Mark Performed
                </button>
              )}
              {activeOrder.status !== 'Approved' && (
                <button
                  type="button"
                  onClick={() => handleOrderAction(activeOrder, 'approve')}
                  className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-md"
                >
                  Approve Final Report
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* New Radiology Order Modal */}
      <Modal open={newOrderOpen} onClose={() => setNewOrderOpen(false)} title="Order Radiology Scan">
        <form onSubmit={handleCreateOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Patient *</label>
            <select
              value={orderForm.patient_id}
              onChange={(e) => setOrderForm({ ...orderForm, patient_id: e.target.value })}
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Scan Type *</label>
            <select
              value={orderForm.scan_id}
              onChange={(e) => setOrderForm({ ...orderForm, scan_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.radiology_scans.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatUGX(s.price)})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setNewOrderOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Order Scan
            </button>
          </div>
        </form>
      </Modal>

      {/* New Scan Catalog Modal */}
      <Modal open={newScanOpen} onClose={() => setNewScanOpen(false)} title="Add Radiology Scan">
        <form onSubmit={handleCreateScan} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Scan Name *</label>
            <input
              required
              value={scanForm.name}
              onChange={(e) => setScanForm({ ...scanForm, name: e.target.value })}
              placeholder="Abdominal Ultrasound..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Price (UGX) *</label>
            <input
              type="number"
              required
              value={scanForm.price}
              onChange={(e) => setScanForm({ ...scanForm, price: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setNewScanOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Save Scan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
