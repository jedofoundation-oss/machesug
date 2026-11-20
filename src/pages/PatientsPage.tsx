import React, { useState } from 'react';
import {
  Activity,
  Edit3,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, calcAge, formatDate, formatDateTime, formatUGX } from '../lib/api';
import type { Patient } from '../types/hmis';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface PatientsPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
  onStartConsultationForPatient: (patientId: string) => void;
}

export const PatientsPage: React.FC<PatientsPageProps> = ({
  state,
  onRefresh,
  onStartConsultationForPatient,
}) => {
  const [query, setQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'All' | 'Female' | 'Male'>('All');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [vitalsModalPatient, setVitalsModalPatient] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '1995-01-01',
    gender: 'Female',
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
  });

  const [vitalsForm, setVitalsForm] = useState({
    blood_pressure_systolic: '120',
    blood_pressure_diastolic: '80',
    temperature: '36.8',
    pulse: '76',
    respiratory_rate: '18',
    weight: '65',
    height: '168',
    spo2: '98',
    notes: '',
  });

  const filtered = state.patients.filter((p) => {
    const matchesGender = genderFilter === 'All' || p.gender === genderFilter;
    const q = query.trim().toLowerCase();
    if (!q) return matchesGender;
    return (
      matchesGender &&
      (`${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q))
    );
  });

  const openNew = () => {
    setEditingPatient(null);
    setForm({
      first_name: '',
      last_name: '',
      date_of_birth: '1995-01-01',
      gender: 'Female',
      phone: '',
      email: '',
      address: '',
      emergency_contact: '',
    });
    setError('');
    setFormOpen(true);
  };

  const openEdit = (p: Patient) => {
    setEditingPatient(p);
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      date_of_birth: p.date_of_birth,
      gender: p.gender,
      phone: p.phone,
      email: p.email,
      address: p.address,
      emergency_contact: p.emergency_contact,
    });
    setError('');
    setFormOpen(true);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingPatient) {
        await apiRequest(`/api/patients/${editingPatient.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest('/api/patients', {
          method: 'POST',
          body: JSON.stringify(form),
        });
      }
      await onRefresh();
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save patient');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePatient = async (p: Patient) => {
    await apiRequest(`/api/patients/${p.id}`, { method: 'DELETE' });
    if (selectedPatient?.id === p.id) setSelectedPatient(null);
    await onRefresh();
  };

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vitalsModalPatient) return;
    setSaving(true);
    try {
      await apiRequest('/api/vitals', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: vitalsModalPatient.id,
          ...vitalsForm,
        }),
      });
      await onRefresh();
      setVitalsModalPatient(null);
    } finally {
      setSaving(false);
    }
  };

  const liveWeight = Number(vitalsForm.weight);
  const liveHeight = Number(vitalsForm.height);
  const liveBmi =
    liveWeight > 0 && liveHeight > 0
      ? (liveWeight / ((liveHeight / 100) * (liveHeight / 100))).toFixed(1)
      : '—';

  const activePatientRecord = selectedPatient
    ? state.patients.find((p) => p.id === selectedPatient.id) || selectedPatient
    : null;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Patients & Triage Vitals</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Register patients, record nursing triage vitals, and access longitudinal clinical charts.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Patient</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, patient code, phone, or Wakiso/address..."
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md self-start sm:self-auto">
          {(['All', 'Female', 'Male'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenderFilter(g)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                genderFilter === g
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-600">No patients match your search criteria.</p>
            <button
              type="button"
              onClick={openNew}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register First Patient</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Full Name</th>
                  <th className="py-2.5 px-4">Gender / Age</th>
                  <th className="py-2.5 px-4">Phone</th>
                  <th className="py-2.5 px-4">Address</th>
                  <th className="py-2.5 px-4">Registered</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-700 tabular-nums">{p.code}</td>
                    <td className="py-2.5 px-4">
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(p)}
                        className="font-semibold text-teal-700 hover:text-teal-900 hover:underline text-left"
                      >
                        {p.first_name} {p.last_name}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 tabular-nums">
                      {p.gender} · {calcAge(p.date_of_birth)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 tabular-nums">{p.phone || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{p.address || '—'}</td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setVitalsModalPatient(p)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded whitespace-nowrap"
                          title="Record Triage Vitals"
                        >
                          <Activity className="w-3.5 h-3.5 text-teal-700" />
                          <span>Vitals</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartConsultationForPatient(p.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded whitespace-nowrap"
                          title="Start Consultation"
                        >
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>Consult</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                          title="Edit Patient"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePatient(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                          title="Delete Patient"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Chart Modal */}
      <Modal
        open={Boolean(activePatientRecord)}
        onClose={() => setSelectedPatient(null)}
        title={
          activePatientRecord
            ? `${activePatientRecord.first_name} ${activePatientRecord.last_name}`
            : ''
        }
        subtitle={
          activePatientRecord
            ? `Patient Code: ${activePatientRecord.code} · ${activePatientRecord.gender} · DOB ${activePatientRecord.date_of_birth} (${calcAge(activePatientRecord.date_of_birth)})`
            : undefined
        }
        maxWidthClass="max-w-3xl"
      >
        {activePatientRecord && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-md p-3.5">
              <div>
                <div className="text-slate-500">Phone</div>
                <div className="font-mono font-medium text-slate-900 mt-0.5">
                  {activePatientRecord.phone || '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Email</div>
                <div className="font-medium text-slate-900 mt-0.5 truncate">
                  {activePatientRecord.email || '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Address & Emergency</div>
                <div className="font-medium text-slate-900 mt-0.5">
                  {activePatientRecord.address || '—'}
                  {activePatientRecord.emergency_contact
                    ? ` · EC: ${activePatientRecord.emergency_contact}`
                    : ''}
                </div>
              </div>
            </div>

            {/* Vitals History */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-800">Triage Vitals History</h4>
                <button
                  type="button"
                  onClick={() => setVitalsModalPatient(activePatientRecord)}
                  className="text-xs font-medium text-teal-700 hover:text-teal-900"
                >
                  + Record Vitals
                </button>
              </div>
              {state.triage_vitals.filter((v) => v.patient_id === activePatientRecord.id).length ===
              0 ? (
                <p className="text-xs text-slate-500 py-2">No triage vitals recorded yet.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-3">Recorded</th>
                        <th className="py-2 px-3">BP</th>
                        <th className="py-2 px-3">Temp</th>
                        <th className="py-2 px-3">Pulse</th>
                        <th className="py-2 px-3">SpO2</th>
                        <th className="py-2 px-3">BMI</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 tabular-nums">
                      {state.triage_vitals
                        .filter((v) => v.patient_id === activePatientRecord.id)
                        .map((v) => (
                          <tr key={v.id}>
                            <td className="py-2 px-3 text-slate-500">{formatDateTime(v.recorded_at)}</td>
                            <td className="py-2 px-3 font-mono">
                              {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}
                            </td>
                            <td className="py-2 px-3 font-mono">{v.temperature} °C</td>
                            <td className="py-2 px-3 font-mono">{v.pulse} bpm</td>
                            <td className="py-2 px-3 font-mono">{v.spo2}%</td>
                            <td className="py-2 px-3 font-mono">{v.bmi ?? '—'}</td>
                            <td className="py-2 px-3 text-slate-600">{v.notes || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Consultations & Invoices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-2">Consultations</h4>
                <div className="space-y-2">
                  {state.consultations
                    .filter((c) => c.patient_id === activePatientRecord.id)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 border border-slate-200 rounded-md text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-medium text-slate-900">{c.code}</div>
                          <div className="text-slate-500 truncate">
                            {c.chief_complaint || c.diagnosis_text || c.consultation_type}
                          </div>
                        </div>
                        <StatusTag status={c.status} />
                      </div>
                    ))}
                  {state.consultations.filter((c) => c.patient_id === activePatientRecord.id)
                    .length === 0 && (
                    <p className="text-xs text-slate-500">No consultations recorded.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-2">Invoices</h4>
                <div className="space-y-2">
                  {state.invoices
                    .filter((i) => i.patient_id === activePatientRecord.id)
                    .map((inv) => (
                      <div
                        key={inv.id}
                        className="p-2.5 border border-slate-200 rounded-md text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-medium text-slate-900 truncate">
                            {inv.invoice_number}
                          </div>
                          <div className="font-mono text-slate-600 tabular-nums">
                            {formatUGX(inv.total_amount)} (Paid {formatUGX(inv.amount_paid)})
                          </div>
                        </div>
                        <StatusTag status={inv.status} />
                      </div>
                    ))}
                  {state.invoices.filter((i) => i.patient_id === activePatientRecord.id).length ===
                    0 && <p className="text-xs text-slate-500">No invoices issued.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Register / Edit Patient Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingPatient ? 'Edit Patient Record' : 'Register New Patient'}
        subtitle="Patient code is generated automatically upon registration."
      >
        <form onSubmit={handleSavePatient} className="space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">First Name *</label>
              <input
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Last Name *</label>
              <input
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                required
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0777..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Wakiso, Kampala..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Emergency Contact
              </label>
              <input
                value={form.emergency_contact}
                onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingPatient ? 'Save Changes' : 'Register Patient'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Triage Vitals Modal */}
      <Modal
        open={Boolean(vitalsModalPatient)}
        onClose={() => setVitalsModalPatient(null)}
        title="Record Triage Vitals"
        subtitle={
          vitalsModalPatient
            ? `${vitalsModalPatient.first_name} ${vitalsModalPatient.last_name} (${vitalsModalPatient.code})`
            : undefined
        }
      >
        <form onSubmit={handleSaveVitals} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">BP Systolic</label>
              <input
                type="number"
                value={vitalsForm.blood_pressure_systolic}
                onChange={(e) =>
                  setVitalsForm({ ...vitalsForm, blood_pressure_systolic: e.target.value })
                }
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">BP Diastolic</label>
              <input
                type="number"
                value={vitalsForm.blood_pressure_diastolic}
                onChange={(e) =>
                  setVitalsForm({ ...vitalsForm, blood_pressure_diastolic: e.target.value })
                }
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={vitalsForm.temperature}
                onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pulse (bpm)</label>
              <input
                type="number"
                value={vitalsForm.pulse}
                onChange={(e) => setVitalsForm({ ...vitalsForm, pulse: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Resp. Rate</label>
              <input
                type="number"
                value={vitalsForm.respiratory_rate}
                onChange={(e) =>
                  setVitalsForm({ ...vitalsForm, respiratory_rate: e.target.value })
                }
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SpO2 (%)</label>
              <input
                type="number"
                value={vitalsForm.spo2}
                onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={vitalsForm.weight}
                onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Height (cm)</label>
              <input
                type="number"
                value={vitalsForm.height}
                onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2">
            <span className="text-slate-600">Calculated BMI</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">{liveBmi} kg/m²</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Triage Notes</label>
            <textarea
              rows={2}
              value={vitalsForm.notes}
              onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
              placeholder="Observations, pain scale, allergies..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setVitalsModalPatient(null)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md"
            >
              {saving ? 'Recording...' : 'Save Vitals'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
