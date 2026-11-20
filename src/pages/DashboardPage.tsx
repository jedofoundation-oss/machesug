import React from 'react';
import {
  ArrowRight,
  BedDouble,
  FlaskConical,
  Pill,
  Receipt,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { formatDate, formatUGX } from '../lib/api';
import { StatusTag } from '../components/StatusTag';
import type { NavSection } from '../components/Layout';

interface DashboardPageProps {
  state: ClientHmisState;
  onNavigate: (section: NavSection) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ state, onNavigate }) => {
  const totalRevenueBilled = state.invoices
    .filter((i) => i.status !== 'Void')
    .reduce((sum, i) => sum + Number(i.total_amount), 0);
  const totalCollected = state.invoices
    .filter((i) => i.status !== 'Void')
    .reduce((sum, i) => sum + Number(i.amount_paid), 0);
  const outstandingDebt = Math.max(0, totalRevenueBilled - totalCollected);

  const occupiedBeds = state.beds.filter((b) => b.status === 'Occupied').length;
  const totalBeds = state.beds.length;

  const pendingLabs = state.lab_orders.filter((l) => l.status !== 'Verified').length;
  const pendingRx = state.prescriptions.filter((p) => !p.is_dispensed).length;
  const lowStockItems = state.inventory_items.filter(
    (i) => i.current_stock <= i.reorder_level
  );

  // Build daily revenue bars from payments
  const dayMap = new Map<string, number>();
  for (const pay of state.payments) {
    const day = pay.paid_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + Number(pay.amount));
  }
  for (const sale of state.pharmacy_sales) {
    const day = sale.sold_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + Number(sale.total));
  }
  const chartDays = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7);
  const maxDayVal = Math.max(1, ...chartDays.map((d) => d[1]));

  const recentConsultations = state.consultations.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Hospital Operations Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time clinical, diagnostic, inpatient, and revenue activity across MachesUg.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('patients')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md transition-colors whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Patient Registry</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('consultations')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors whitespace-nowrap"
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>New Consultation</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Registered Patients</span>
            <Users className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
            {state.patients.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {state.consultations.length} total consultations · {state.admissions.filter((a) => a.status === 'Admitted').length} admitted
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Collected Revenue</span>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums font-mono">
            {formatUGX(totalCollected)}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Outstanding: <span className="font-mono text-amber-700">{formatUGX(outstandingDebt)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Bed Occupancy</span>
            <BedDouble className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
            {occupiedBeds} / {totalBeds}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}% occupied across {state.wards.length} wards
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Queues</span>
            <FlaskConical className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
            {pendingLabs + pendingRx}
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {pendingLabs} lab orders · {pendingRx} prescriptions · {lowStockItems.length} low stock
          </div>
        </div>
      </div>

      {/* Main Split: Revenue Chart + Department Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Cash & Mobile Money Collections Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Daily Collections Trend</h3>
              <p className="text-xs text-slate-500">Payments & walk-in pharmacy sales by date</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('billing')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap"
            >
              <span>Financial Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {chartDays.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No payment activity recorded yet.
            </div>
          ) : (
            <div className="h-52 flex items-end gap-3 pt-4 border-b border-slate-100 pb-2">
              {chartDays.map(([day, val]) => {
                const heightPct = Math.max(8, Math.round((val / maxDayVal) * 100));
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <div className="text-[11px] font-mono text-slate-600 tabular-nums truncate max-w-full">
                      {val.toLocaleString()}
                    </div>
                    <div className="w-full max-w-[48px] bg-slate-100 rounded-t h-32 flex items-end overflow-hidden">
                      <div
                        className="w-full bg-teal-600 rounded-t transition-all duration-300"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums truncate max-w-full">
                      {formatDate(day)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ward Occupancy & Alerts */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Ward Bed Capacity</h3>
              <button
                type="button"
                onClick={() => onNavigate('inpatient')}
                className="text-xs font-medium text-teal-700 hover:text-teal-900"
              >
                Manage
              </button>
            </div>
            <div className="space-y-3">
              {state.wards.map((ward) => {
                const wBeds = state.beds.filter((b) => b.ward_id === ward.id);
                const wOcc = wBeds.filter((b) => b.status === 'Occupied').length;
                const pct = wBeds.length > 0 ? Math.round((wOcc / wBeds.length) * 100) : 0;
                return (
                  <div key={ward.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{ward.name}</span>
                      <span className="font-mono text-slate-600 tabular-nums">
                        {wOcc}/{wBeds.length} beds
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 85 ? 'bg-rose-600' : 'bg-teal-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-800">Inventory Reorder Alerts</h4>
              <button
                type="button"
                onClick={() => onNavigate('pharmacy')}
                className="text-xs font-medium text-teal-700 hover:text-teal-900"
              >
                Pharmacy
              </button>
            </div>
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-500">All pharmacy items are above reorder levels.</p>
            ) : (
              <div className="space-y-2">
                {lowStockItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Pill className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="text-slate-800 truncate">{item.name}</span>
                    </div>
                    <span className="font-mono text-rose-700 font-medium tabular-nums shrink-0">
                      {item.current_stock} left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Consultations Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Recent Consultations</h3>
          <button
            type="button"
            onClick={() => onNavigate('consultations')}
            className="text-xs font-medium text-teal-700 hover:text-teal-900 whitespace-nowrap"
          >
            View All Consultations
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">Patient</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Doctor</th>
                <th className="py-2.5 px-4">Chief Complaint</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentConsultations.map((c) => {
                const pat = state.patients.find((p) => p.id === c.patient_id);
                const doc = state.doctors.find((d) => d.id === c.doctor_id);
                const docUser = state.users.find((u) => u.id === doc?.user_id);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-700 tabular-nums">{c.code}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {pat ? `${pat.first_name} ${pat.last_name}` : 'Unknown'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{c.consultation_type}</td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {docUser ? `Dr. ${docUser.full_name}` : 'Assigned Doctor'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">
                      {c.chief_complaint || c.diagnosis_text || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                      {formatDate(c.scheduled_start)}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusTag status={c.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
