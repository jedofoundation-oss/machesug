import React, { useState } from 'react';
import { HeartHandshake, Plus } from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDate, formatUGX } from '../lib/api';
import type { Donation } from '../types/hmis';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface DonationsPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
}

export const DonationsPage: React.FC<DonationsPageProps> = ({ state, onRefresh }) => {
  const [newOpen, setNewOpen] = useState(false);
  const [allocDon, setAllocDon] = useState<Donation | null>(null);
  const [allocatedTo, setAllocatedTo] = useState('General Ward');

  const [form, setForm] = useState({
    donor_name: '',
    donor_contact: '',
    donation_type: 'Medical Equipment',
    description: '',
    quantity: '1',
    estimated_value: '500000',
    received_date: new Date().toISOString().slice(0, 10),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/donations', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    await onRefresh();
    setNewOpen(false);
    setForm({
      donor_name: '',
      donor_contact: '',
      donation_type: 'Medical Equipment',
      description: '',
      quantity: '1',
      estimated_value: '500000',
      received_date: new Date().toISOString().slice(0, 10),
    });
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocDon) return;
    await apiRequest(`/api/donations/${allocDon.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Allocated', allocated_to: allocatedTo }),
    });
    await onRefresh();
    setAllocDon(null);
  };

  const handleMarkUsed = async (don: Donation) => {
    await apiRequest(`/api/donations/${don.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Used' }),
    });
    await onRefresh();
  };

  const totalValue = state.donations.reduce((s, d) => s + Number(d.estimated_value || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Hospital Donations & Grants</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Track donor contributions, allocate equipment or funds to wards, and audit utilization.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Record Donation</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Total Donations Recorded</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {state.donations.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Estimated Total Value</div>
          <div className="text-2xl font-semibold text-emerald-700 mt-1 font-mono tabular-nums">
            {formatUGX(totalValue)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Awaiting Allocation</div>
          <div className="text-2xl font-semibold text-amber-700 mt-1 tabular-nums">
            {state.donations.filter((d) => d.status === 'Received').length}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <th className="py-2.5 px-4">Donor</th>
              <th className="py-2.5 px-4">Type & Description</th>
              <th className="py-2.5 px-4 text-right">Qty</th>
              <th className="py-2.5 px-4 text-right">Est. Value</th>
              <th className="py-2.5 px-4">Received</th>
              <th className="py-2.5 px-4">Allocated To</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.donations.map((d) => (
              <tr key={d.id}>
                <td className="py-2.5 px-4">
                  <div className="font-semibold text-slate-900">{d.donor_name}</div>
                  <div className="text-slate-500">{d.donor_contact}</div>
                </td>
                <td className="py-2.5 px-4">
                  <div className="font-medium text-slate-800">{d.donation_type}</div>
                  <div className="text-slate-500">{d.description}</div>
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums">{d.quantity}</td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                  {formatUGX(d.estimated_value)}
                </td>
                <td className="py-2.5 px-4 tabular-nums">{formatDate(d.received_date)}</td>
                <td className="py-2.5 px-4 text-slate-700">{d.allocated_to || '—'}</td>
                <td className="py-2.5 px-4">
                  <StatusTag status={d.status} />
                </td>
                <td className="py-2.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {d.status === 'Received' && (
                      <button
                        type="button"
                        onClick={() => setAllocDon(d)}
                        className="px-2.5 py-1 text-xs font-medium bg-teal-600 text-white rounded"
                      >
                        Allocate
                      </button>
                    )}
                    {d.status === 'Allocated' && (
                      <button
                        type="button"
                        onClick={() => handleMarkUsed(d)}
                        className="px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white rounded"
                      >
                        Mark Used
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Record New Donation">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Donor Name *</label>
              <input
                required
                value={form.donor_name}
                onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact</label>
              <input
                value={form.donor_contact}
                onChange={(e) => setForm({ ...form, donor_contact: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
              <select
                value={form.donation_type}
                onChange={(e) => setForm({ ...form, donation_type: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Medical Equipment">Medical Equipment</option>
                <option value="Pharmaceuticals">Pharmaceuticals</option>
                <option value="Cash Grant">Cash Grant</option>
                <option value="Consumables">Consumables</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Received Date</label>
              <input
                type="date"
                value={form.received_date}
                onChange={(e) => setForm({ ...form, received_date: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description *</label>
            <input
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Estimated Value (UGX)
              </label>
              <input
                type="number"
                value={form.estimated_value}
                onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setNewOpen(false)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Save Donation
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(allocDon)} onClose={() => setAllocDon(null)} title="Allocate Donation">
        <form onSubmit={handleAllocate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Ward / Department *
            </label>
            <input
              required
              value={allocatedTo}
              onChange={(e) => setAllocatedTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setAllocDon(null)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Confirm Allocation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
