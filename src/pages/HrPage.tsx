import React, { useState } from 'react';
import {
  BriefcaseMedical,
  CalendarCheck,
  Check,
  Clock,
  DollarSign,
  Plus,
  Star,
  X,
} from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDate, formatUGX } from '../lib/api';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface HrPageProps {
  state: ClientHmisState;
  onRefresh: () => Promise<void>;
}

export const HrPage: React.FC<HrPageProps> = ({ state, onRefresh }) => {
  const [tab, setTab] = useState<'employees' | 'attendance' | 'leave' | 'payroll' | 'reviews'>('employees');
  const [empOpen, setEmpOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [revOpen, setRevOpen] = useState(false);

  const [empForm, setEmpForm] = useState({
    full_name: '',
    department: 'Nursing',
    position: 'Registered Nurse',
    base_salary: '1500000',
    phone: '',
  });
  const [leaveForm, setLeaveForm] = useState({
    employee_id: state.employees[0]?.id || '',
    leave_type: 'Annual',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const [revForm, setRevForm] = useState({
    employee_id: state.employees[0]?.id || '',
    review_date: new Date().toISOString().slice(0, 10),
    reviewer_name: 'Administrator',
    rating: '5',
    strengths: '',
    improvements: '',
  });

  const handleClock = async (employeeId: string, action: 'in' | 'out') => {
    await apiRequest('/api/hr/attendance/clock', {
      method: 'POST',
      body: JSON.stringify({ employee_id: employeeId, action }),
    });
    await onRefresh();
  };

  const handleGeneratePayroll = async () => {
    await apiRequest('/api/hr/payroll/generate', {
      method: 'POST',
      body: JSON.stringify({ pay_period: new Date().toISOString().slice(0, 7) }),
    });
    await onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Human Resources & Payroll</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Hospital staff directory, shift attendance clock-in/out, leave approvals, payroll, and appraisals.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md whitespace-nowrap"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Request Leave</span>
          </button>
          <button
            type="button"
            onClick={() => setEmpOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        {[
          { id: 'employees', label: `Employees (${state.employees.length})` },
          { id: 'attendance', label: 'Attendance' },
          { id: 'leave', label: `Leave (${state.leave_requests.length})` },
          { id: 'payroll', label: `Payroll (${state.payroll.length})` },
          { id: 'reviews', label: `Performance (${state.performance_reviews.length})` },
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

      {tab === 'employees' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">Full Name</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Position</th>
                <th className="py-2.5 px-4 text-right">Base Salary</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Shift Clock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-mono text-slate-600">{emp.employee_code}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{emp.full_name}</td>
                  <td className="py-2.5 px-4 text-slate-700">{emp.department}</td>
                  <td className="py-2.5 px-4 text-slate-600">{emp.position}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatUGX(emp.base_salary)}
                  </td>
                  <td className="py-2.5 px-4">
                    <StatusTag status={emp.status} />
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleClock(emp.id, 'in')}
                        className="px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded"
                      >
                        Clock In
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClock(emp.id, 'out')}
                        className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded"
                      >
                        Clock Out
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Clock In</th>
                <th className="py-2.5 px-4">Clock Out</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.attendance.map((a) => {
                const emp = state.employees.find((e) => e.id === a.employee_id);
                return (
                  <tr key={a.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {emp?.full_name || 'Employee'}
                    </td>
                    <td className="py-2.5 px-4 tabular-nums">{formatDate(a.date)}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">{a.clock_in}</td>
                    <td className="py-2.5 px-4 font-mono tabular-nums">{a.clock_out || 'Active'}</td>
                    <td className="py-2.5 px-4">
                      <StatusTag status={a.status} />
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{a.note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'leave' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Dates</th>
                <th className="py-2.5 px-4">Reason</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.leave_requests.map((lv) => {
                const emp = state.employees.find((e) => e.id === lv.employee_id);
                return (
                  <tr key={lv.id}>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {emp?.full_name || 'Employee'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{lv.leave_type}</td>
                    <td className="py-2.5 px-4 tabular-nums">
                      {formatDate(lv.start_date)} – {formatDate(lv.end_date)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{lv.reason}</td>
                    <td className="py-2.5 px-4">
                      <StatusTag status={lv.status} />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {lv.status === 'Pending' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/hr/leave/${lv.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: 'Approved' }),
                              });
                              await onRefresh();
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-600 text-white rounded"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/hr/leave/${lv.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: 'Rejected' }),
                              });
                              await onRefresh();
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-rose-600 text-white rounded"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
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
      )}

      {tab === 'payroll' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGeneratePayroll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Generate Current Month Payroll</span>
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-4">Period</th>
                  <th className="py-2.5 px-4 text-right">Base</th>
                  <th className="py-2.5 px-4 text-right">Allowances</th>
                  <th className="py-2.5 px-4 text-right">Deductions</th>
                  <th className="py-2.5 px-4 text-right">Net Pay</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {state.payroll.map((p) => {
                  const emp = state.employees.find((e) => e.id === p.employee_id);
                  return (
                    <tr key={p.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {emp?.full_name || 'Employee'}
                      </td>
                      <td className="py-2.5 px-4 font-mono">{p.pay_period}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{formatUGX(p.base_salary)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-700">
                        +{formatUGX(p.allowances)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-700">
                        -{formatUGX(p.deductions)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900">
                        {formatUGX(p.net_pay)}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={p.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {p.status !== 'Paid' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/hr/payroll/${p.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: 'Paid' }),
                              });
                              await onRefresh();
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-emerald-600 text-white rounded"
                          >
                            Mark Paid
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

      {tab === 'reviews' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setRevOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-md"
            >
              <Star className="w-3.5 h-3.5" />
              <span>New Performance Review</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {state.performance_reviews.map((r) => {
              const emp = state.employees.find((e) => e.id === r.employee_id);
              return (
                <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">
                      {emp?.full_name || 'Employee'}
                    </span>
                    <span className="font-mono font-semibold text-teal-700">
                      Rating: {r.rating} / 5
                    </span>
                  </div>
                  <div className="text-slate-500">
                    Reviewed by {r.reviewer_name} · {formatDate(r.review_date)}
                  </div>
                  <p className="text-slate-700">
                    <strong>Strengths:</strong> {r.strengths}
                  </p>
                  <p className="text-slate-600">
                    <strong>Improvements:</strong> {r.improvements}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal open={empOpen} onClose={() => setEmpOpen(false)} title="Add Staff Employee">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await apiRequest('/api/hr/employees', {
              method: 'POST',
              body: JSON.stringify(empForm),
            });
            await onRefresh();
            setEmpOpen(false);
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
            <input
              required
              value={empForm.full_name}
              onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
              <input
                value={empForm.department}
                onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Position</label>
              <input
                value={empForm.position}
                onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Base Salary (UGX)
              </label>
              <input
                type="number"
                value={empForm.base_salary}
                onChange={(e) => setEmpForm({ ...empForm, base_salary: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                value={empForm.phone}
                onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setEmpOpen(false)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Add Employee
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Submit Leave Request">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await apiRequest('/api/hr/leave', {
              method: 'POST',
              body: JSON.stringify(leaveForm),
            });
            await onRefresh();
            setLeaveOpen(false);
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Employee</label>
            <select
              value={leaveForm.employee_id}
              onChange={(e) => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
            >
              {state.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
              <select
                value={leaveForm.leave_type}
                onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                <option value="Annual">Annual</option>
                <option value="Sick">Sick</option>
                <option value="Maternity">Maternity</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Start</label>
              <input
                type="date"
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">End</label>
              <input
                type="date"
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason *</label>
            <input
              required
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setLeaveOpen(false)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Submit Request
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={revOpen} onClose={() => setRevOpen(false)} title="Record Performance Appraisal">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await apiRequest('/api/hr/performance', {
              method: 'POST',
              body: JSON.stringify(revForm),
            });
            await onRefresh();
            setRevOpen(false);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Employee</label>
              <select
                value={revForm.employee_id}
                onChange={(e) => setRevForm({ ...revForm, employee_id: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                {state.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Rating (1–5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={revForm.rating}
                onChange={(e) => setRevForm({ ...revForm, rating: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Strengths *</label>
            <input
              required
              value={revForm.strengths}
              onChange={(e) => setRevForm({ ...revForm, strengths: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Areas for Growth</label>
            <input
              value={revForm.improvements}
              onChange={(e) => setRevForm({ ...revForm, improvements: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setRevOpen(false)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Save Appraisal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
