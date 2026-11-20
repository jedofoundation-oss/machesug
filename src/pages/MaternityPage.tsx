import React, { useState } from 'react';
import { Baby, CheckCircle2, Plus, Printer } from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDate } from '../lib/api';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface MaternityPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
}

export const MaternityPage: React.FC<MaternityPageProps> = ({ state, onRefresh }) => {
  const [tab, setTab] = useState<'antenatal' | 'deliveries' | 'babies' | 'immunisations' | 'postnatal'>('antenatal');
  const [ancOpen, setAncOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [babyOpen, setBabyOpen] = useState(false);
  const [pncOpen, setPncOpen] = useState(false);

  const femalePatients = state.patients.filter((p) => p.gender === 'Female');

  const [ancForm, setAncForm] = useState({
    patient_id: femalePatients[0]?.id || state.patients[0]?.id || '',
    visit_date: new Date().toISOString().slice(0, 10),
    gestational_weeks: '24',
    fundal_height_cm: '24',
    fetal_heart_rate: '142',
    blood_pressure: '118/76',
    weight_kg: '64',
    risk_level: 'Low',
    next_visit_date: '',
    notes: '',
    attended_by: 'Sarah Namuli',
  });

  const [delForm, setDelForm] = useState({
    mother_patient_id: femalePatients[0]?.id || '',
    delivery_date: new Date().toISOString().slice(0, 10),
    delivery_mode: 'Normal Vaginal',
    outcome: 'Live Birth',
    complications: 'None',
    attended_by: 'Kamoga Charles',
    notes: '',
  });

  const [babyForm, setBabyForm] = useState({
    delivery_id: state.deliveries[0]?.id || '',
    mother_patient_id: femalePatients[0]?.id || '',
    name: '',
    gender: 'Female',
    date_of_birth: new Date().toISOString().slice(0, 10),
    birth_weight_kg: '3.1',
    apgar_score: '9/10',
    status: 'Healthy',
  });

  const [pncForm, setPncForm] = useState({
    mother_patient_id: femalePatients[0]?.id || '',
    baby_id: state.babies[0]?.id || '',
    visit_date: new Date().toISOString().slice(0, 10),
    mother_condition: 'Stable, afebrile',
    baby_condition: 'Active, feeding well',
    breastfeeding_status: 'Exclusive breastfeeding',
    notes: '',
  });

  const handleAddAnc = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/maternity/antenatal', { method: 'POST', body: JSON.stringify(ancForm) });
    await onRefresh();
    setAncOpen(false);
  };

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/maternity/deliveries', { method: 'POST', body: JSON.stringify(delForm) });
    await onRefresh();
    setDelOpen(false);
  };

  const handleAddBaby = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/maternity/babies', { method: 'POST', body: JSON.stringify(babyForm) });
    await onRefresh();
    setBabyOpen(false);
  };

  const handleAddPnc = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/maternity/postnatal', { method: 'POST', body: JSON.stringify(pncForm) });
    await onRefresh();
    setPncOpen(false);
  };

  const handleAdministerVaccine = async (immId: string) => {
    await apiRequest(`/api/maternity/immunisations/${immId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'Administered',
        administered_date: new Date().toISOString().slice(0, 10),
        batch_number: `VAC-${Math.floor(1000 + Math.random() * 8999)}`,
        administered_by: 'Sarah Namuli',
      }),
    });
    await onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Maternity & Child Health</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Antenatal care clinics, labor deliveries, newborn registry, immunization schedules, and postnatal visits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAncOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ANC Visit</span>
          </button>
          <button
            type="button"
            onClick={() => setDelOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Delivery</span>
          </button>
          <button
            type="button"
            onClick={() => setBabyOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 rounded-md whitespace-nowrap"
          >
            <Baby className="w-4 h-4" />
            <span>Register Newborn</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Antenatal Visits</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {state.antenatal_visits.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Deliveries Logged</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {state.deliveries.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Registered Babies</div>
          <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">
            {state.babies.length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Scheduled Vaccines</div>
          <div className="text-2xl font-semibold text-amber-700 mt-1 tabular-nums">
            {state.immunisations.filter((i) => i.status === 'Scheduled').length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        {[
          { id: 'antenatal', label: 'Antenatal' },
          { id: 'deliveries', label: 'Deliveries' },
          { id: 'babies', label: 'Newborns' },
          { id: 'immunisations', label: 'Immunisations' },
          { id: 'postnatal', label: 'Postnatal' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'antenatal' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Mother</th>
                <th className="py-2.5 px-4">Visit Date</th>
                <th className="py-2.5 px-4">Gestation</th>
                <th className="py-2.5 px-4">BP / FHR</th>
                <th className="py-2.5 px-4">Risk</th>
                <th className="py-2.5 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.antenatal_visits.map((v) => {
                const pat = state.patients.find((p) => p.id === v.patient_id);
                return (
                  <tr key={v.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {pat ? `${pat.first_name} ${pat.last_name}` : 'Patient'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 tabular-nums">
                      {formatDate(v.visit_date)}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">{v.gestational_weeks} wks</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">
                      {v.blood_pressure} · {v.fetal_heart_rate || '—'} bpm
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusTag status={v.risk_level} />
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{v.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Mother</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Mode</th>
                <th className="py-2.5 px-4">Outcome</th>
                <th className="py-2.5 px-4">Attended By</th>
                <th className="py-2.5 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.deliveries.map((d) => {
                const pat = state.patients.find((p) => p.id === d.mother_patient_id);
                return (
                  <tr key={d.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {pat ? `${pat.first_name} ${pat.last_name}` : 'Patient'}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums">{formatDate(d.delivery_date)}</td>
                    <td className="py-2.5 px-4 text-slate-800">{d.delivery_mode}</td>
                    <td className="py-2.5 px-4 text-emerald-700 font-medium">{d.outcome}</td>
                    <td className="py-2.5 px-4 text-slate-600">{d.attended_by}</td>
                    <td className="py-2.5 px-4 text-slate-600">{d.notes || d.complications}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'babies' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Baby Name</th>
                <th className="py-2.5 px-4">Mother</th>
                <th className="py-2.5 px-4">Gender</th>
                <th className="py-2.5 px-4">DOB</th>
                <th className="py-2.5 px-4">Weight / APGAR</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.babies.map((b) => {
                const mom = state.patients.find((p) => p.id === b.mother_patient_id);
                return (
                  <tr key={b.id}>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{b.name}</td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {mom ? `${mom.first_name} ${mom.last_name}` : 'Mother'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{b.gender}</td>
                    <td className="py-2.5 px-4 tabular-nums">{formatDate(b.date_of_birth)}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">
                      {b.birth_weight_kg} kg · APGAR {b.apgar_score}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusTag status={b.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'immunisations' && (
        <div className="space-y-3">
          <div className="flex justify-end no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Vaccine Schedule</span>
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Child</th>
                  <th className="py-2.5 px-4">Vaccine</th>
                  <th className="py-2.5 px-4">Due Date</th>
                  <th className="py-2.5 px-4">Administered</th>
                  <th className="py-2.5 px-4">Batch #</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.immunisations.map((im) => {
                  const baby = state.babies.find((b) => b.id === im.baby_id);
                  const vt = state.immunisation_types.find((t) => t.id === im.vaccine_type_id);
                  return (
                    <tr key={im.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {baby?.name || 'Infant'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">{vt?.name || 'Vaccine'}</td>
                      <td className="py-2.5 px-4 tabular-nums">{formatDate(im.due_date)}</td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {formatDate(im.administered_date)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {im.batch_number || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={im.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right no-print">
                        {im.status !== 'Administered' && (
                          <button
                            type="button"
                            onClick={() => handleAdministerVaccine(im.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white rounded"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Given</span>
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

      {tab === 'postnatal' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setPncOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Postnatal Visit</span>
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Mother</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Mother Condition</th>
                  <th className="py-2.5 px-4">Baby Condition</th>
                  <th className="py-2.5 px-4">Breastfeeding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.postnatal_visits.map((p) => {
                  const mom = state.patients.find((x) => x.id === p.mother_patient_id);
                  return (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {mom ? `${mom.first_name} ${mom.last_name}` : 'Mother'}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">{formatDate(p.visit_date)}</td>
                      <td className="py-2.5 px-4 text-slate-700">{p.mother_condition}</td>
                      <td className="py-2.5 px-4 text-slate-700">{p.baby_condition}</td>
                      <td className="py-2.5 px-4 text-slate-700">{p.breastfeeding_status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal open={ancOpen} onClose={() => setAncOpen(false)} title="Record Antenatal Visit">
        <form onSubmit={handleAddAnc} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mother *</label>
            <select
              value={ancForm.patient_id}
              onChange={(e) => setAncForm({ ...ancForm, patient_id: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
            >
              {femalePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gestation (wks)</label>
              <input
                type="number"
                value={ancForm.gestational_weeks}
                onChange={(e) => setAncForm({ ...ancForm, gestational_weeks: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Risk Level</label>
              <select
                value={ancForm.risk_level}
                onChange={(e) => setAncForm({ ...ancForm, risk_level: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Low">Low</option>
                <option value="Moderate">Moderate</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Blood Pressure</label>
              <input
                value={ancForm.blood_pressure}
                onChange={(e) => setAncForm({ ...ancForm, blood_pressure: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">FHR (bpm)</label>
              <input
                type="number"
                value={ancForm.fetal_heart_rate}
                onChange={(e) => setAncForm({ ...ancForm, fetal_heart_rate: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Clinical Notes</label>
            <textarea
              rows={2}
              value={ancForm.notes}
              onChange={(e) => setAncForm({ ...ancForm, notes: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAncOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 rounded-md"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Save ANC Visit
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Record Delivery">
        <form onSubmit={handleAddDelivery} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mother *</label>
            <select
              value={delForm.mother_patient_id}
              onChange={(e) => setDelForm({ ...delForm, mother_patient_id: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
            >
              {femalePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mode</label>
              <select
                value={delForm.delivery_mode}
                onChange={(e) => setDelForm({ ...delForm, delivery_mode: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Normal Vaginal">Normal Vaginal</option>
                <option value="C-Section">C-Section</option>
                <option value="Assisted">Assisted</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Outcome</label>
              <select
                value={delForm.outcome}
                onChange={(e) => setDelForm({ ...delForm, outcome: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Live Birth">Live Birth</option>
                <option value="Multiple Birth">Multiple Birth</option>
                <option value="Stillbirth">Stillbirth</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
            <input
              value={delForm.notes}
              onChange={(e) => setDelForm({ ...delForm, notes: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setDelOpen(false)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Save Delivery
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={babyOpen}
        onClose={() => setBabyOpen(false)}
        title="Register Newborn Baby"
        subtitle="Automatically generates the national immunization schedule."
      >
        <form onSubmit={handleAddBaby} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Baby Name *</label>
            <input
              required
              value={babyForm.name}
              onChange={(e) => setBabyForm({ ...babyForm, name: e.target.value })}
              placeholder="Baby ..."
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gender</label>
              <select
                value={babyForm.gender}
                onChange={(e) => setBabyForm({ ...babyForm, gender: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Birth Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={babyForm.birth_weight_kg}
                onChange={(e) => setBabyForm({ ...babyForm, birth_weight_kg: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={babyForm.date_of_birth}
                onChange={(e) => setBabyForm({ ...babyForm, date_of_birth: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">APGAR Score</label>
              <input
                value={babyForm.apgar_score}
                onChange={(e) => setBabyForm({ ...babyForm, apgar_score: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setBabyOpen(false)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Register Baby
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={pncOpen} onClose={() => setPncOpen(false)} title="Record Postnatal Visit">
        <form onSubmit={handleAddPnc} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mother *</label>
            <select
              value={pncForm.mother_patient_id}
              onChange={(e) => setPncForm({ ...pncForm, mother_patient_id: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
            >
              {femalePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mother Condition</label>
            <input
              value={pncForm.mother_condition}
              onChange={(e) => setPncForm({ ...pncForm, mother_condition: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Baby Condition</label>
            <input
              value={pncForm.baby_condition}
              onChange={(e) => setPncForm({ ...pncForm, baby_condition: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Breastfeeding</label>
            <input
              value={pncForm.breastfeeding_status}
              onChange={(e) => setPncForm({ ...pncForm, breastfeeding_status: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setPncOpen(false)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Save Visit
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
