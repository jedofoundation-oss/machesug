import React, { useState } from 'react';
import {
  CheckCircle2,
  FlaskConical,
  Plus,
  Printer,
  TestTube2,
  Trash2,
} from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDateTime, formatUGX } from '../lib/api';
import type { LabOrder } from '../types/hmis';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface LaboratoryPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
}

export const LaboratoryPage: React.FC<LaboratoryPageProps> = ({ state, onRefresh }) => {
  const [stageTab, setStageTab] = useState<'all' | 'pick' | 'enter' | 'review' | 'ready' | 'catalog'>('all');
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newTestOpen, setNewTestOpen] = useState(false);
  const [actionOrder, setActionOrder] = useState<LabOrder | null>(null);
  const [actionMode, setActionMode] = useState<'collect' | 'result' | 'verify' | 'print' | null>(null);

  const [sampleIdInput, setSampleIdInput] = useState('');
  const [resultNotesInput, setResultNotesInput] = useState('');

  const [orderForm, setOrderForm] = useState({
    patient_id: state.patients[0]?.id || '',
    test_id: state.lab_tests[0]?.id || '',
  });
  const [testForm, setTestForm] = useState({
    name: '',
    normal_range: '',
    price: '15000',
  });

  const openAction = (order: LabOrder, mode: 'collect' | 'result' | 'verify' | 'print') => {
    setActionOrder(order);
    setActionMode(mode);
    setSampleIdInput(order.sample_id || `SMP-${Math.floor(1000 + Math.random() * 9000)}`);
    setResultNotesInput(order.result_notes || '');
  };

  const handleSubmitOrderAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionOrder || !actionMode || actionMode === 'print') return;
    await apiRequest(`/api/lab/orders/${actionOrder.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        action: actionMode === 'result' ? 'enter_result' : actionMode,
        sample_id: sampleIdInput,
        result_notes: resultNotesInput,
      }),
    });
    await onRefresh();
    setActionOrder(null);
    setActionMode(null);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/lab/orders', {
      method: 'POST',
      body: JSON.stringify(orderForm),
    });
    await onRefresh();
    setNewOrderOpen(false);
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/lab/tests', {
      method: 'POST',
      body: JSON.stringify(testForm),
    });
    await onRefresh();
    setNewTestOpen(false);
    setTestForm({ name: '', normal_range: '', price: '15000' });
  };

  const handleDeleteTest = async (id: string) => {
    await apiRequest(`/api/lab/tests/${id}`, { method: 'DELETE' });
    await onRefresh();
  };

  const filteredOrders = state.lab_orders.filter((o) => {
    if (stageTab === 'pick') return o.status === 'Pending';
    if (stageTab === 'enter') return o.status === 'Collected' || o.status === 'Processing';
    if (stageTab === 'review') return o.status === 'Completed';
    if (stageTab === 'ready') return o.status === 'Verified';
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Laboratory Diagnostics</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Sample collection, bench result entry, verification, printable reports, and test catalog.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setNewTestOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lab Test</span>
          </button>
          <button
            type="button"
            onClick={() => setNewOrderOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md whitespace-nowrap"
          >
            <FlaskConical className="w-4 h-4" />
            <span>New Lab Order</span>
          </button>
        </div>
      </div>

      {/* Stage Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        {[
          { id: 'all', label: `All Orders (${state.lab_orders.length})` },
          { id: 'pick', label: `Pick Sample (${state.lab_orders.filter((o) => o.status === 'Pending').length})` },
          { id: 'enter', label: `Enter Results (${state.lab_orders.filter((o) => o.status === 'Collected' || o.status === 'Processing').length})` },
          { id: 'review', label: `Review (${state.lab_orders.filter((o) => o.status === 'Completed').length})` },
          { id: 'ready', label: `Results Ready (${state.lab_orders.filter((o) => o.status === 'Verified').length})` },
          { id: 'catalog', label: `Test Catalog (${state.lab_tests.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStageTab(t.id as typeof stageTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              stageTab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {stageTab === 'catalog' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Test Name</th>
                <th className="py-2.5 px-4">Normal Reference Range</th>
                <th className="py-2.5 px-4 text-right">Price</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.lab_tests.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-medium text-slate-900">{t.name}</td>
                  <td className="py-2.5 px-4 text-slate-600">{t.normal_range || '—'}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatUGX(t.price)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDeleteTest(t.id)}
                      className="p-1 text-slate-400 hover:text-rose-700"
                      title="Delete Test"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
                  <th className="py-2.5 px-4">Sample ID</th>
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Test</th>
                  <th className="py-2.5 px-4">Ordered</th>
                  <th className="py-2.5 px-4">Result Notes</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Workflow Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      No laboratory orders in this workflow stage.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const pat = state.patients.find((p) => p.id === o.patient_id);
                    const test = state.lab_tests.find((t) => t.id === o.test_id);
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono text-slate-700 tabular-nums">
                          {o.sample_id || 'Uncollected'}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-800">{test?.name || 'Lab Test'}</td>
                        <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                          {formatDateTime(o.ordered_at)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate">
                          {o.result_notes || '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusTag status={o.status} />
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {o.status === 'Pending' && (
                              <button
                                type="button"
                                onClick={() => openAction(o, 'collect')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded whitespace-nowrap"
                              >
                                <TestTube2 className="w-3.5 h-3.5" />
                                <span>Pick Sample</span>
                              </button>
                            )}
                            {(o.status === 'Collected' || o.status === 'Processing') && (
                              <button
                                type="button"
                                onClick={() => openAction(o, 'result')}
                                className="px-2.5 py-1 text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 rounded whitespace-nowrap"
                              >
                                Enter Results
                              </button>
                            )}
                            {o.status === 'Completed' && (
                              <button
                                type="button"
                                onClick={() => openAction(o, 'verify')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 rounded whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verify</span>
                              </button>
                            )}
                            {o.status === 'Verified' && (
                              <button
                                type="button"
                                onClick={() => openAction(o, 'print')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded whitespace-nowrap"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Report</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Workflow Action / Print Modal */}
      <Modal
        open={Boolean(actionOrder && actionMode)}
        onClose={() => {
          setActionOrder(null);
          setActionMode(null);
        }}
        title={
          actionMode === 'collect'
            ? 'Collect Laboratory Sample'
            : actionMode === 'result'
              ? 'Enter Laboratory Results'
              : actionMode === 'verify'
                ? 'Review & Verify Results'
                : 'Verified Laboratory Report'
        }
      >
        {actionOrder && actionMode === 'print' ? (
          (() => {
            const pat = state.patients.find((p) => p.id === actionOrder.patient_id);
            const test = state.lab_tests.find((t) => t.id === actionOrder.test_id);
            return (
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-md p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <div className="text-base font-bold text-slate-900">MachesHMS Laboratory</div>
                      <div className="text-slate-500">MachesUg Clinical Diagnostics</div>
                    </div>
                    <div className="text-right font-mono">
                      <div>Sample: {actionOrder.sample_id || '—'}</div>
                      <div>Verified: {formatDateTime(actionOrder.verified_at)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-500">Patient:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'} ({pat?.code})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Investigation:</span>{' '}
                      <span className="font-semibold text-slate-900">{test?.name}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3">
                    <div className="text-slate-500 mb-1">Result Findings</div>
                    <div className="text-sm font-medium text-slate-900">
                      {actionOrder.result_notes || 'No remarks'}
                    </div>
                    {test?.normal_range && (
                      <div className="text-slate-500 mt-1">
                        Reference Range: {test.normal_range}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 no-print">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Report</span>
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <form onSubmit={handleSubmitOrderAction} className="space-y-4">
            {actionMode === 'collect' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sample Barcode / Specimen ID *
                </label>
                <input
                  required
                  value={sampleIdInput}
                  onChange={(e) => setSampleIdInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
                />
              </div>
            )}
            {(actionMode === 'result' || actionMode === 'verify') && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Result Findings & Quantitative Notes *
                </label>
                <textarea
                  required
                  rows={3}
                  value={resultNotesInput}
                  onChange={(e) => setResultNotesInput(e.target.value)}
                  placeholder="Negative / WBC 6.2 x10^9/L..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActionOrder(null);
                  setActionMode(null);
                }}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md"
              >
                {actionMode === 'collect'
                  ? 'Confirm Collection'
                  : actionMode === 'result'
                    ? 'Submit Results'
                    : 'Approve & Verify'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* New Lab Order Modal */}
      <Modal
        open={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        title="Create Direct Lab Order"
        subtitle="Automatically bills test price to patient invoice."
      >
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
            <label className="block text-xs font-medium text-slate-700 mb-1">Lab Test *</label>
            <select
              value={orderForm.test_id}
              onChange={(e) => setOrderForm({ ...orderForm, test_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.lab_tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({formatUGX(t.price)})
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
              className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md"
            >
              Place Lab Order
            </button>
          </div>
        </form>
      </Modal>

      {/* New Lab Test Modal */}
      <Modal
        open={newTestOpen}
        onClose={() => setNewTestOpen(false)}
        title="Add Laboratory Test to Catalog"
      >
        <form onSubmit={handleCreateTest} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Test Name *</label>
            <input
              required
              value={testForm.name}
              onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
              placeholder="Urinalysis, Widal Test..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Normal Reference Range
            </label>
            <input
              value={testForm.normal_range}
              onChange={(e) => setTestForm({ ...testForm, normal_range: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Price (UGX) *</label>
            <input
              type="number"
              required
              value={testForm.price}
              onChange={(e) => setTestForm({ ...testForm, price: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setNewTestOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md"
            >
              Add Test
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
