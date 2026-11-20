import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Pill,
  Plus,
  ScanLine,
  Stethoscope,
} from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDateTime, formatUGX } from '../lib/api';
import type { Consultation } from '../types/hmis';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface ConsultationsPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
  preselectedPatientId?: string | null;
  onClearPreselectedPatient?: () => void;
}

export const ConsultationsPage: React.FC<ConsultationsPageProps> = ({
  state,
  onRefresh,
  preselectedPatientId,
  onClearPreselectedPatient,
}) => {
  const [tab, setTab] = useState<'queue' | 'calendar' | 'availability'>('queue');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [activeCons, setActiveCons] = useState<Consultation | null>(null);
  const [saving, setSaving] = useState(false);

  const [newForm, setNewForm] = useState({
    patient_id: state.patients[0]?.id || '',
    doctor_id: state.doctors[0]?.id || '',
    consultation_type: 'OPD',
    scheduled_start: new Date().toISOString().slice(0, 16),
    chief_complaint: '',
  });

  useEffect(() => {
    if (preselectedPatientId) {
      setNewForm((f) => ({
        ...f,
        patient_id: preselectedPatientId,
        doctor_id: state.doctors[0]?.id || '',
      }));
      setNewModalOpen(true);
      onClearPreselectedPatient?.();
    }
  }, [preselectedPatientId, state.doctors, onClearPreselectedPatient]);

  // Clinical Encounter state
  const [clinicalNotes, setClinicalNotes] = useState({
    chief_complaint: '',
    history_of_presenting_illness: '',
    past_medical_history: '',
    examination_findings: '',
    diagnosis_codes: '',
    diagnosis_text: '',
  });

  const [rxForm, setRxForm] = useState({
    drug_name: 'Panadol',
    dosage: '500mg',
    route: 'Oral',
    frequency: 'TDS',
    duration_days: '5',
    quantity: '15',
    instructions: 'After meals',
  });

  const [labTestId, setLabTestId] = useState(state.lab_tests[0]?.id || '');
  const [radScanId, setRadScanId] = useState(state.radiology_scans[0]?.id || '');

  const openEncounter = (c: Consultation) => {
    setActiveCons(c);
    setClinicalNotes({
      chief_complaint: c.chief_complaint || '',
      history_of_presenting_illness: c.history_of_presenting_illness || '',
      past_medical_history: c.past_medical_history || '',
      examination_findings: c.examination_findings || '',
      diagnosis_codes: c.diagnosis_codes.join(', '),
      diagnosis_text: c.diagnosis_text || '',
    });
    if (!labTestId && state.lab_tests[0]) setLabTestId(state.lab_tests[0].id);
    if (!radScanId && state.radiology_scans[0]) setRadScanId(state.radiology_scans[0].id);
  };

  const handleCreateConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await apiRequest<Consultation>('/api/consultations', {
        method: 'POST',
        body: JSON.stringify({
          ...newForm,
          scheduled_start: new Date(newForm.scheduled_start).toISOString(),
          status: 'InProgress',
        }),
      });
      await onRefresh();
      setNewModalOpen(false);
      openEncounter(created);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async (nextStatus?: Consultation['status']) => {
    if (!activeCons) return;
    setSaving(true);
    try {
      const updated = await apiRequest<Consultation>(`/api/consultations/${activeCons.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          chief_complaint: clinicalNotes.chief_complaint,
          history_of_presenting_illness: clinicalNotes.history_of_presenting_illness,
          past_medical_history: clinicalNotes.past_medical_history,
          examination_findings: clinicalNotes.examination_findings,
          diagnosis_codes: clinicalNotes.diagnosis_codes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          diagnosis_text: clinicalNotes.diagnosis_text,
          ...(nextStatus ? { status: nextStatus } : {}),
        }),
      });
      await onRefresh();
      setActiveCons(updated);
      if (nextStatus === 'Completed') {
        setActiveCons(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCons) return;
    await apiRequest(`/api/consultations/${activeCons.id}/prescriptions`, {
      method: 'POST',
      body: JSON.stringify(rxForm),
    });
    await onRefresh();
  };

  const handleOrderLab = async () => {
    if (!activeCons || !labTestId) return;
    await apiRequest('/api/lab/orders', {
      method: 'POST',
      body: JSON.stringify({
        consultation_id: activeCons.id,
        patient_id: activeCons.patient_id,
        test_id: labTestId,
      }),
    });
    await onRefresh();
  };

  const handleOrderRadiology = async () => {
    if (!activeCons || !radScanId) return;
    await apiRequest('/api/radiology/orders', {
      method: 'POST',
      body: JSON.stringify({
        consultation_id: activeCons.id,
        patient_id: activeCons.patient_id,
        scan_id: radScanId,
      }),
    });
    await onRefresh();
  };

  const filtered = state.consultations.filter(
    (c) => statusFilter === 'All' || c.status === statusFilter
  );

  const liveActiveCons = activeCons
    ? state.consultations.find((c) => c.id === activeCons.id) || activeCons
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Consultations & Appointments</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            OPD/IPD doctor workbench, clinical notes, ICD diagnosis, prescriptions, and diagnostic orders.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Consultation</span>
        </button>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
          {[
            { id: 'queue', label: 'Consultations Queue', icon: ClipboardList },
            { id: 'calendar', label: 'Appointments Schedule', icon: Calendar },
            { id: 'availability', label: 'Doctor Availability', icon: Stethoscope },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as typeof tab)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {tab === 'queue' && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {['All', 'Scheduled', 'InProgress', 'Completed'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'queue' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Doctor</th>
                  <th className="py-2.5 px-4">Complaint / Diagnosis</th>
                  <th className="py-2.5 px-4">Scheduled</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((c) => {
                  const pat = state.patients.find((p) => p.id === c.patient_id);
                  const doc = state.doctors.find((d) => d.id === c.doctor_id);
                  const docUser = state.users.find((u) => u.id === doc?.user_id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-700 tabular-nums">
                        {c.code}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{c.consultation_type}</td>
                      <td className="py-2.5 px-4 text-slate-700">
                        {docUser ? `Dr. ${docUser.full_name}` : 'Doctor'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                        {c.chief_complaint || c.diagnosis_text || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                        {formatDateTime(c.scheduled_start)}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={c.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEncounter(c)}
                          className="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded whitespace-nowrap"
                        >
                          {c.status === 'Completed' ? 'View Chart' : 'Open Encounter'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'calendar' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Scheduled & Active Appointments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.consultations.map((c) => {
              const pat = state.patients.find((p) => p.id === c.patient_id);
              const doc = state.doctors.find((d) => d.id === c.doctor_id);
              const docUser = state.users.find((u) => u.id === doc?.user_id);
              return (
                <div
                  key={c.id}
                  className="p-4 border border-slate-200 rounded-lg flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-slate-500">{c.code}</span>
                      <StatusTag status={c.status} />
                    </div>
                    <div className="mt-2 font-semibold text-sm text-slate-900">
                      {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown Patient'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {docUser ? `Dr. ${docUser.full_name}` : 'Doctor'} · {c.consultation_type}
                    </div>
                    <div className="text-xs text-slate-600 mt-2">
                      {c.chief_complaint || 'Routine clinical evaluation'}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 tabular-nums">
                      {formatDateTime(c.scheduled_start)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEncounter(c)}
                      className="font-medium text-teal-700 hover:text-teal-900"
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'availability' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Clinician Duty Roster</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Doctor</th>
                  <th className="py-2.5 px-4">Specialization</th>
                  <th className="py-2.5 px-4">Day</th>
                  <th className="py-2.5 px-4">Clinic Hours</th>
                  <th className="py-2.5 px-4">Slot Duration</th>
                  <th className="py-2.5 px-4 text-right">Consultation Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.doctor_availability.map((av) => {
                  const doc = state.doctors.find((d) => d.id === av.doctor_id);
                  const docUser = state.users.find((u) => u.id === doc?.user_id);
                  return (
                    <tr key={av.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        Dr. {docUser?.full_name || 'Clinician'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {doc?.specialization || 'General Medicine'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">{av.day_of_week}</td>
                      <td className="py-2.5 px-4 font-mono tabular-nums">
                        {av.start_time} – {av.end_time}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">{av.slot_minutes} mins</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {formatUGX(doc?.consultation_fee)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Consultation Modal */}
      <Modal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title="Schedule / Start Consultation"
        subtitle="Creates an encounter and routes patient to doctor queue."
      >
        <form onSubmit={handleCreateConsultation} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Patient *</label>
            <select
              required
              value={newForm.patient_id}
              onChange={(e) => setNewForm({ ...newForm, patient_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Doctor *</label>
              <select
                required
                value={newForm.doctor_id}
                onChange={(e) => setNewForm({ ...newForm, doctor_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
              >
                {state.doctors.map((d) => {
                  const u = state.users.find((x) => x.id === d.user_id);
                  return (
                    <option key={d.id} value={d.id}>
                      Dr. {u?.full_name || d.id} ({formatUGX(d.consultation_fee)})
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Visit Type</label>
              <select
                value={newForm.consultation_type}
                onChange={(e) => setNewForm({ ...newForm, consultation_type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="OPD">Outpatient (OPD)</option>
                <option value="IPD">Inpatient (IPD)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Scheduled Time</label>
            <input
              type="datetime-local"
              value={newForm.scheduled_start}
              onChange={(e) => setNewForm({ ...newForm, scheduled_start: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Chief Complaint</label>
            <input
              value={newForm.chief_complaint}
              onChange={(e) => setNewForm({ ...newForm, chief_complaint: e.target.value })}
              placeholder="Fever, cough, abdominal pain..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setNewModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md"
            >
              {saving ? 'Creating...' : 'Create & Open Encounter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Clinical Encounter Workbench Modal */}
      <Modal
        open={Boolean(liveActiveCons)}
        onClose={() => setActiveCons(null)}
        title={liveActiveCons ? `Clinical Encounter · ${liveActiveCons.code}` : ''}
        subtitle={
          liveActiveCons
            ? (() => {
                const pat = state.patients.find((p) => p.id === liveActiveCons.patient_id);
                return `${pat ? `${pat.first_name} ${pat.last_name} (${pat.code})` : ''} · ${liveActiveCons.consultation_type}`;
              })()
            : undefined
        }
        maxWidthClass="max-w-4xl"
      >
        {liveActiveCons && (
          <div className="space-y-5">
            {/* Clinical Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Chief Complaint
                </label>
                <input
                  value={clinicalNotes.chief_complaint}
                  onChange={(e) =>
                    setClinicalNotes({ ...clinicalNotes, chief_complaint: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ICD-10 Diagnosis Codes (comma separated)
                </label>
                <input
                  value={clinicalNotes.diagnosis_codes}
                  onChange={(e) =>
                    setClinicalNotes({ ...clinicalNotes, diagnosis_codes: e.target.value })
                  }
                  placeholder="B50.9, R51"
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  History of Presenting Illness
                </label>
                <textarea
                  rows={2}
                  value={clinicalNotes.history_of_presenting_illness}
                  onChange={(e) =>
                    setClinicalNotes({
                      ...clinicalNotes,
                      history_of_presenting_illness: e.target.value,
                    })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Examination Findings
                </label>
                <textarea
                  rows={2}
                  value={clinicalNotes.examination_findings}
                  onChange={(e) =>
                    setClinicalNotes({ ...clinicalNotes, examination_findings: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Clinical Impression & Diagnosis Notes
                </label>
                <input
                  value={clinicalNotes.diagnosis_text}
                  onChange={(e) =>
                    setClinicalNotes({ ...clinicalNotes, diagnosis_text: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <StatusTag status={liveActiveCons.status} />
                <span className="text-xs text-slate-500">
                  Completing automatically adds consultation fee to patient invoice.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveNotes('InProgress')}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md"
                >
                  Save Clinical Notes
                </button>
                {liveActiveCons.status !== 'Completed' && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveNotes('Completed')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete Consultation</span>
                  </button>
                )}
              </div>
            </div>

            {/* Prescriptions & Diagnostic Orders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Add Prescription */}
              <div className="border border-slate-200 rounded-md p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Pill className="w-4 h-4 text-teal-700" />
                  <span>Prescriptions</span>
                </div>
                <form onSubmit={handleAddPrescription} className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    required
                    value={rxForm.drug_name}
                    onChange={(e) => setRxForm({ ...rxForm, drug_name: e.target.value })}
                    placeholder="Drug name"
                    className="col-span-2 px-2.5 py-1.5 border border-slate-200 rounded"
                  />
                  <input
                    value={rxForm.dosage}
                    onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })}
                    placeholder="Dosage (e.g. 500mg)"
                    className="px-2.5 py-1.5 border border-slate-200 rounded"
                  />
                  <input
                    value={rxForm.frequency}
                    onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })}
                    placeholder="Frequency (e.g. TDS)"
                    className="px-2.5 py-1.5 border border-slate-200 rounded"
                  />
                  <input
                    type="number"
                    value={rxForm.duration_days}
                    onChange={(e) => setRxForm({ ...rxForm, duration_days: e.target.value })}
                    placeholder="Days"
                    className="px-2.5 py-1.5 border border-slate-200 rounded"
                  />
                  <input
                    type="number"
                    value={rxForm.quantity}
                    onChange={(e) => setRxForm({ ...rxForm, quantity: e.target.value })}
                    placeholder="Qty"
                    className="px-2.5 py-1.5 border border-slate-200 rounded"
                  />
                  <button
                    type="submit"
                    className="col-span-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded"
                  >
                    + Add Prescription
                  </button>
                </form>
                <div className="space-y-1.5 pt-1">
                  {state.prescriptions
                    .filter((p) => p.consultation_id === liveActiveCons.id)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-1.5 border-t border-slate-100"
                      >
                        <div>
                          <span className="font-medium text-slate-900">{p.drug_name}</span>{' '}
                          <span className="text-slate-500">
                            {p.dosage} {p.frequency} · Qty {p.quantity}
                          </span>
                        </div>
                        <StatusTag status={p.is_dispensed ? 'Dispensed' : 'Pending'} />
                      </div>
                    ))}
                </div>
              </div>

              {/* Lab & Radiology Orders */}
              <div className="border border-slate-200 rounded-md p-3.5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <FlaskConical className="w-4 h-4 text-teal-700" />
                    <span>Order Laboratory Test</span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={labTestId}
                      onChange={(e) => setLabTestId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
                    >
                      {state.lab_tests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({formatUGX(t.price)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleOrderLab}
                      className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded whitespace-nowrap"
                    >
                      Order Lab
                    </button>
                  </div>
                  <div className="space-y-1">
                    {state.lab_orders
                      .filter((o) => o.consultation_id === liveActiveCons.id)
                      .map((o) => {
                        const t = state.lab_tests.find((x) => x.id === o.test_id);
                        return (
                          <div
                            key={o.id}
                            className="flex items-center justify-between text-xs py-1 border-t border-slate-100"
                          >
                            <span className="text-slate-800">{t?.name || 'Lab Test'}</span>
                            <StatusTag status={o.status} />
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <ScanLine className="w-4 h-4 text-teal-700" />
                    <span>Order Radiology Scan</span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={radScanId}
                      onChange={(e) => setRadScanId(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
                    >
                      {state.radiology_scans.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatUGX(s.price)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleOrderRadiology}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded whitespace-nowrap"
                    >
                      Order Scan
                    </button>
                  </div>
                  <div className="space-y-1">
                    {state.radiology_orders
                      .filter((o) => o.consultation_id === liveActiveCons.id)
                      .map((o) => {
                        const s = state.radiology_scans.find((x) => x.id === o.scan_id);
                        return (
                          <div
                            key={o.id}
                            className="flex items-center justify-between text-xs py-1 border-t border-slate-100"
                          >
                            <span className="text-slate-800">{s?.name || 'Scan'}</span>
                            <StatusTag status={o.status} />
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
