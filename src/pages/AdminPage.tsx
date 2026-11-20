import React, { useRef, useState } from 'react';
import { Download, RotateCcw, Upload, UserPlus, Power } from 'lucide-react';
import type { ClientHmisState } from '../lib/api';
import { apiRequest, formatDateTime, formatUGX } from '../lib/api';
import {
  exportDatabaseBackup,
  importDatabaseBackup,
  resetLocalDatabase,
} from '../lib/localStore';
import type { User, UserRole } from '../types/hmis';
import { NAV_ITEMS } from '../components/Layout';
import { Modal } from '../components/Modal';
import { StatusTag } from '../components/StatusTag';

interface AdminPageProps {
  state: ClientHmisState;
  currentUser: User;
  onSwitchUser: (u: User) => void;
  onRefresh: () => Promise<void>;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  state,
  currentUser,
  onSwitchUser,
  onRefresh,
}) => {
  const [tab, setTab] = useState<'users' | 'roles' | 'audit' | 'backup'>('users');
  const [newOpen, setNewOpen] = useState(false);
  const [error, setError] = useState('');
  const [backupNotice, setBackupNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    username: '',
    full_name: '',
    role: 'Doctor' as UserRole,
    password: 'password123',
    specialization: 'General Practice',
    consultation_fee: '15000',
    email: '',
    phone: '',
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await onRefresh();
      setNewOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    await apiRequest(`/api/users/${userId}/toggle`, { method: 'PUT' });
    await onRefresh();
  };

  const handleToggleModulePermission = async (role: UserRole, moduleId: string) => {
    const existing = state.role_permissions.find((r) => r.role === role);
    const curr = existing?.modules || [];
    const next = curr.includes(moduleId)
      ? curr.filter((m) => m !== moduleId)
      : [...curr, moduleId];
    await apiRequest('/api/admin/roles', {
      method: 'PUT',
      body: JSON.stringify({ role, modules: next }),
    });
    await onRefresh();
  };

  const handleExportBackup = () => {
    const json = exportDatabaseBackup();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maches-hms-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupNotice({ type: 'ok', text: 'Full hospital backup JSON downloaded.' });
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importDatabaseBackup(text);
      await onRefresh();
      setBackupNotice({ type: 'ok', text: `Restored hospital database from ${file.name}.` });
    } catch (err) {
      setBackupNotice({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to import backup file.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetDemo = async () => {
    resetLocalDatabase();
    await onRefresh();
    setConfirmReset(false);
    setBackupNotice({ type: 'ok', text: 'Hospital database reset to initial Ugandan hospital records.' });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Users, Roles & Governance</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage hospital accounts, doctor profiles, role-based access permissions, and system audit logs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setNewOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff User</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
        {[
          { id: 'users', label: `Staff & Doctors (${state.users.length})` },
          { id: 'roles', label: 'Role Permissions' },
          { id: 'audit', label: `Audit Logs (${state.audit_logs.length})` },
          { id: 'backup', label: 'Backup & Restore' },
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

      {tab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Full Name</th>
                  <th className="py-2.5 px-4">Username</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Doctor Fee / Spec</th>
                  <th className="py-2.5 px-4">Last Login</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.users.map((u) => {
                  const doc = state.doctors.find((d) => d.user_id === u.id);
                  return (
                    <tr key={u.id}>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{u.full_name}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">{u.username}</td>
                      <td className="py-2.5 px-4 text-slate-800">{u.role}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {doc
                          ? `${doc.specialization || 'General'} · ${formatUGX(doc.consultation_fee)}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                        {formatDateTime(u.last_login)}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusTag status={u.is_active ? 'Active' : 'Inactive'} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.id !== currentUser.id && u.is_active && (
                            <button
                              type="button"
                              onClick={() => onSwitchUser(u)}
                              className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded whitespace-nowrap"
                            >
                              Switch Account
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 rounded"
                            title="Toggle Active Status"
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{u.is_active ? 'Disable' : 'Enable'}</span>
                          </button>
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

      {tab === 'roles' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-4">Module</th>
                  {state.role_permissions.map((rp) => (
                    <th key={rp.role} className="py-2.5 px-3 text-center">
                      {rp.role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {NAV_ITEMS.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{item.label}</td>
                    {state.role_permissions.map((rp) => {
                      const checked = rp.modules.includes(item.id);
                      const locked = rp.role === 'Admin';
                      return (
                        <td key={rp.role} className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => handleToggleModulePermission(rp.role, item.id)}
                            className="w-4 h-4 accent-teal-600 cursor-pointer disabled:opacity-50"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Entity</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Performed By</th>
                <th className="py-2.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.audit_logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-4 text-slate-500 tabular-nums">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-800">{log.entity_type}</td>
                  <td className="py-2.5 px-4 font-mono text-teal-700">{log.action}</td>
                  <td className="py-2.5 px-4 text-slate-700">{log.performed_by}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 max-w-sm truncate">
                    {JSON.stringify(log.changes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {backupNotice && (
            <div
              className={`lg:col-span-3 p-3 text-xs rounded-md border ${
                backupNotice.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {backupNotice.text}
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Export Full Backup</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Download all patients, consultations, lab/radiology orders, pharmacy stock, invoices,
              and staff accounts as a portable JSON file to share across devices.
            </p>
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON Backup</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Restore from Backup</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Import a previously exported MachesHMS JSON backup file into this browser&apos;s local
              storage. Existing data on this device will be replaced.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload JSON Backup</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Reset Local Database</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Clear changes stored on this device and restore the initial Ugandan hospital seed
              records.
            </p>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-md"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Seed Data</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDemo}
                  className="px-3 py-1.5 text-xs font-medium bg-rose-600 text-white rounded-md"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Create User / Clinician Account">
        <form onSubmit={handleCreateUser} className="space-y-3">
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
              >
                {(['Admin', 'Doctor', 'Nurse', 'Receptionist', 'LabTechnician', 'Pharmacist', 'Cashier'] as UserRole[]).map(
                  (r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password *</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          {form.role === 'Doctor' && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Specialization
                </label>
                <input
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Consultation Fee (UGX)
                </label>
                <input
                  type="number"
                  value={form.consultation_fee}
                  onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md font-mono"
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setNewOpen(false)} className="px-4 py-2 text-xs text-slate-600">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md">
              Create Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
