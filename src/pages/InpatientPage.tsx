import React, { useState } from 'react';
import { ArrowRightLeft, BedDouble, LogOut, Plus } from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDate, formatUGX } from '../lib/api';
import type { Admission } from '../types/hmis';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface InpatientPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
}

export const InpatientPage: React.FC<InpatientPageProps> = ({ state, onRefresh }) => {
  const [tab, setTab] = useState<'admissions' | 'wards'>('admissions');
  const [admitOpen, setAdmitOpen] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  const [bedOpen, setBedOpen] = useState(false);
  const [transferAdm, setTransferAdm] = useState<Admission | null>(null);
  const [dischargeAdm, setDischargeAdm] = useState<Admission | null>(null);
  const [error, setError] = useState('');

  const availableBeds = state.beds.filter((b) => b.status === 'Available');
  const openConsultations = state.consultations.filter(
    (c) => !state.admissions.some((a) => a.consultation_id === c.id && a.status === 'Admitted')
  );

  const [admitForm, setAdmitForm] = useState({
    consultation_id: openConsultations[0]?.id || '',
    bed_id: availableBeds[0]?.id || '',
    admission_date: new Date().toISOString().slice(0, 10),
    expected_discharge_date: '',
  });

  const [wardForm, setWardForm] = useState({ name: '', floor: '1', description: '' });
  const [bedForm, setBedForm] = useState({
    ward_id: state.wards[0]?.id || '',
    room_number: '102',
    bed_number: '',
    daily_rent: '50000',
  });
  const [targetBedId, setTargetBedId] = useState(availableBeds[0]?.id || '');
  const [dischargeSummary, setDischargeSummary] = useState('');

  const handleAdmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/admissions', {
        method: 'POST',
        body: JSON.stringify(admitForm),
      });
      await onRefresh();
      setAdmitOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admission failed');
    }
  };

  const handleCreateWard = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/wards', { method: 'POST', body: JSON.stringify(wardForm) });
    await onRefresh();
    setWardOpen(false);
    setWardForm({ name: '', floor: '1', description: '' });
  };

  const handleCreateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/beds', { method: 'POST', body: JSON.stringify(bedForm) });
    await onRefresh();
    setBedOpen(false);
    setBedForm({ ...bedForm, bed_number: '' });
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAdm) return;
    await apiRequest('/api/admissions/transfer', {
      method: 'POST',
      body: JSON.stringify({ admission_id: transferAdm.id, new_bed_id: targetBedId }),
    });
    await onRefresh();
    setTransferAdm(null);
  };

  const handleDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dischargeAdm) return;
    await apiRequest('/api/admissions/discharge', {
      method: 'POST',
      body: JSON.stringify({
        admission_id: dischargeAdm.id,
        discharge_summary: dischargeSummary,
      }),
    });
    await onRefresh();
    setDischargeAdm(null);
    setDischargeSummary('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Wards, Beds & Inpatient Care</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Admit patients, manage bed occupancy transfers, and process inpatient discharge billing.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setWardOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Ward</span>
          </button>
          <button
            type="button"
            onClick={() => setBedOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bed</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setError('');
              setAdmitForm({
                consultation_id: openConsultations[0]?.id || '',
                bed_id: availableBeds[0]?.id || '',
                admission_date: new Date().toISOString().slice(0, 10),
                expected_discharge_date: '',
              });
              setAdmitOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md whitespace-nowrap"
          >
            <BedDouble className="w-4 h-4" />
            <span>Admit Patient</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        <button
          type="button"
          onClick={() => setTab('admissions')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            tab === 'admissions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Admissions ({state.admissions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('wards')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            tab === 'wards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Wards & Beds ({state.beds.length})
        </button>
      </div>

      {tab === 'admissions' ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Consultation</th>
                  <th className="py-2.5 px-4">Ward & Bed</th>
                  <th className="py-2.5 px-4">Admitted</th>
                  <th className="py-2.5 px-4">Expected / Actual Discharge</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.admissions.map((adm) => {
                  const cons = state.consultations.find((c) => c.id === adm.consultation_id);
                  const pat = state.patients.find((p) => p.id === cons?.patient_id);
                  const bed = state.beds.find((b) => b.id === adm.bed_id);
                  const ward = state.wards.find((w) => w.id === bed?.ward_id);
                  return (
                    <tr key={adm.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{cons?.code || '—'}</td>
                      <td className="py-2.5 px-4 text-slate-800">
                        {ward?.name || 'Ward'} · <span className="font-mono">{bed?.bed_number || '—'}</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 tabular-nums">
                        {formatDate(adm.admission_date)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 tabular-nums">
                        {adm.actual_discharge_date
                          ? formatDate(adm.actual_discharge_date)
                          : formatDate(adm.expected_discharge_date)}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={adm.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {adm.status === 'Admitted' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTransferAdm(adm);
                                setTargetBedId(availableBeds[0]?.id || '');
                              }}
                              disabled={availableBeds.length === 0}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-40 whitespace-nowrap"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>Transfer</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDischargeAdm(adm)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded whitespace-nowrap"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Discharge</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {state.wards.map((ward) => {
            const beds = state.beds.filter((b) => b.ward_id === ward.id);
            return (
              <div key={ward.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {ward.name} {ward.floor ? `· Floor ${ward.floor}` : ''}
                    </h3>
                    {ward.description && (
                      <p className="text-xs text-slate-500">{ward.description}</p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-600 tabular-nums">
                    {beds.filter((b) => b.status === 'Available').length} / {beds.length} available
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {beds.map((bed) => (
                    <div
                      key={bed.id}
                      className="p-3 border border-slate-200 rounded-md flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-mono text-sm font-semibold text-slate-900">
                          {bed.bed_number}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {bed.room_number ? `Rm ${bed.room_number} · ` : ''}
                          {formatUGX(bed.daily_rent)}/day
                        </div>
                      </div>
                      <StatusTag status={bed.status} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admit Patient Modal */}
      <Modal open={admitOpen} onClose={() => setAdmitOpen(false)} title="Admit Patient to Inpatient Bed">
        <form onSubmit={handleAdmit} className="space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Consultation *</label>
            <select
              required
              value={admitForm.consultation_id}
              onChange={(e) => setAdmitForm({ ...admitForm, consultation_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {openConsultations.map((c) => {
                const pat = state.patients.find((p) => p.id === c.patient_id);
                return (
                  <option key={c.id} value={c.id}>
                    {c.code} — {pat ? `${pat.first_name} ${pat.last_name}` : 'Patient'}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Available Bed *</label>
            <select
              required
              value={admitForm.bed_id}
              onChange={(e) => setAdmitForm({ ...admitForm, bed_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {availableBeds.map((b) => {
                const w = state.wards.find((x) => x.id === b.ward_id);
                return (
                  <option key={b.id} value={b.id}>
                    {w?.name} · {b.bed_number} ({formatUGX(b.daily_rent)}/day)
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Admission Date
              </label>
              <input
                type="date"
                value={admitForm.admission_date}
                onChange={(e) => setAdmitForm({ ...admitForm, admission_date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Expected Discharge
              </label>
              <input
                type="date"
                value={admitForm.expected_discharge_date}
                onChange={(e) =>
                  setAdmitForm({ ...admitForm, expected_discharge_date: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAdmitOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Confirm Admission
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Bed Modal */}
      <Modal
        open={Boolean(transferAdm)}
        onClose={() => setTransferAdm(null)}
        title="Transfer Patient Bed"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Available Bed
            </label>
            <select
              value={targetBedId}
              onChange={(e) => setTargetBedId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {availableBeds.map((b) => {
                const w = state.wards.find((x) => x.id === b.ward_id);
                return (
                  <option key={b.id} value={b.id}>
                    {w?.name} · {b.bed_number}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setTransferAdm(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Confirm Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Discharge Modal */}
      <Modal
        open={Boolean(dischargeAdm)}
        onClose={() => setDischargeAdm(null)}
        title="Discharge Inpatient"
        subtitle="Frees the bed and automatically calculates daily bed rent on the patient invoice."
      >
        <form onSubmit={handleDischarge} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Discharge Summary & Follow-Up Plan *
            </label>
            <textarea
              required
              rows={3}
              value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
              placeholder="Patient afebrile, vitals stable. Continue oral medications..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDischargeAdm(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded-md"
            >
              Discharge & Bill Bed Stay
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Ward Modal */}
      <Modal open={wardOpen} onClose={() => setWardOpen(false)} title="Create New Ward">
        <form onSubmit={handleCreateWard} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Ward Name *</label>
            <input
              required
              value={wardForm.name}
              onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })}
              placeholder="Pediatric Ward"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Floor</label>
            <input
              type="number"
              value={wardForm.floor}
              onChange={(e) => setWardForm({ ...wardForm, floor: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <input
              value={wardForm.description}
              onChange={(e) => setWardForm({ ...wardForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setWardOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Create Ward
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Bed Modal */}
      <Modal open={bedOpen} onClose={() => setBedOpen(false)} title="Add Ward Bed">
        <form onSubmit={handleCreateBed} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Ward *</label>
            <select
              value={bedForm.ward_id}
              onChange={(e) => setBedForm({ ...bedForm, ward_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bed Number *</label>
              <input
                required
                value={bedForm.bed_number}
                onChange={(e) => setBedForm({ ...bedForm, bed_number: e.target.value })}
                placeholder="B-103"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Room</label>
              <input
                value={bedForm.room_number}
                onChange={(e) => setBedForm({ ...bedForm, room_number: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Daily Rent (UGX) *
            </label>
            <input
              type="number"
              required
              value={bedForm.daily_rent}
              onChange={(e) => setBedForm({ ...bedForm, daily_rent: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setBedOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Add Bed
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
