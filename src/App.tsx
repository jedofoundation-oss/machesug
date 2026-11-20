import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest, type ClientHmisState } from './lib/api';
import type { User } from './types/hmis';
import { Layout, type NavSection } from './components/Layout';
import { Modal } from './components/Modal';
import { OfflineIndicator } from './components/PWAInstallButton';
import { DashboardPage } from './pages/DashboardPage';
import { PatientsPage } from './pages/PatientsPage';
import { ConsultationsPage } from './pages/ConsultationsPage';
import { LaboratoryPage } from './pages/LaboratoryPage';
import { RadiologyPage } from './pages/RadiologyPage';
import { PharmacyPage } from './pages/PharmacyPage';
import { InpatientPage } from './pages/InpatientPage';
import { BillingPage } from './pages/BillingPage';
import { MaternityPage } from './pages/MaternityPage';
import { HrPage } from './pages/HrPage';
import { DonationsPage } from './pages/DonationsPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  const [state, setState] = useState<ClientHmisState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    newPassword: '',
  });

  const refreshState = useCallback(async () => {
    try {
      const data = await apiRequest<ClientHmisState>('/api/state');
      setState(data);
      setError('');
      setCurrentUser((prev) => {
        if (prev) {
          const fresh = data.users.find((u) => u.id === prev.id);
          return fresh || prev;
        }
        return data.users.find((u) => u.role === 'Admin') || data.users[0] || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load HMIS state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleMarkNotificationRead = async (id: string) => {
    await apiRequest('/api/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ notification_id: id }),
    });
    await refreshState();
  };

  const handleClearReadNotifications = async () => {
    await apiRequest('/api/notifications/clear-read', { method: 'DELETE' });
    await refreshState();
  };

  const handleOpenProfile = () => {
    if (!currentUser) return;
    setProfileForm({
      full_name: currentUser.full_name,
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      newPassword: '',
    });
    setProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    await apiRequest('/api/users/profile', {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUser.id,
        full_name: profileForm.full_name,
        email: profileForm.email,
        phone: profileForm.phone,
        ...(profileForm.newPassword ? { newPassword: profileForm.newPassword } : {}),
      }),
    });
    await refreshState();
    setProfileOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 space-y-3">
          <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-4/5 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-rose-200 rounded-lg p-6 space-y-3 text-sm">
          <h2 className="font-semibold text-rose-800">Unable to load MachesHMS data</h2>
          <p className="text-slate-600 text-xs">{error}</p>
          <button
            type="button"
            onClick={() => refreshState()}
            className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loggedOut || !currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setLoggedOut(false);
          setActiveSection('dashboard');
          refreshState();
        }}
      />
    );
  }

  const rolePerm = state.role_permissions.find((r) => r.role === currentUser.role);
  const allowedModules = rolePerm?.modules || ['dashboard'];

  return (
    <>
      <Layout
        activeSection={activeSection}
        onNavigate={setActiveSection}
        currentUser={currentUser}
        allowedModules={allowedModules}
        notifications={state.notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onClearReadNotifications={handleClearReadNotifications}
        onOpenProfile={handleOpenProfile}
        onLogout={() => setLoggedOut(true)}
      >
        {activeSection === 'dashboard' && (
          <DashboardPage state={state} onNavigate={setActiveSection} />
        )}
        {activeSection === 'patients' && (
          <PatientsPage
            state={state}
            onRefresh={refreshState}
            onStartConsultationForPatient={(pid) => {
              setPreselectedPatientId(pid);
              setActiveSection('consultations');
            }}
          />
        )}
        {activeSection === 'consultations' && (
          <ConsultationsPage
            state={state}
            onRefresh={refreshState}
            preselectedPatientId={preselectedPatientId}
            onClearPreselectedPatient={() => setPreselectedPatientId(null)}
          />
        )}
        {activeSection === 'laboratory' && (
          <LaboratoryPage state={state} onRefresh={refreshState} />
        )}
        {activeSection === 'radiology' && (
          <RadiologyPage state={state} onRefresh={refreshState} />
        )}
        {activeSection === 'pharmacy' && (
          <PharmacyPage state={state} onRefresh={refreshState} />
        )}
        {activeSection === 'inpatient' && (
          <InpatientPage state={state} onRefresh={refreshState} />
        )}
        {activeSection === 'billing' && (
          <BillingPage state={state} onRefresh={refreshState} />
        )}
        {activeSection === 'maternity' && (
          <MaternityPage state={state} onRefresh={refreshState} />
        )}
        {activeSection === 'hr' && <HrPage state={state} onRefresh={refreshState} />}
        {activeSection === 'donations' && (
          <DonationsPage state={state} onRefresh={refreshState} />
        )}
        {activeSection === 'admin' && (
          <AdminPage
            state={state}
            currentUser={currentUser}
            onSwitchUser={(u) => {
              setCurrentUser(u);
              setActiveSection('dashboard');
            }}
            onRefresh={refreshState}
          />
        )}
      </Layout>

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="User Profile & Security"
        subtitle={`Account: ${currentUser.username} · Role: ${currentUser.role}`}
      >
        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
            <input
              required
              value={profileForm.full_name}
              onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              New Password (leave blank to keep current)
            </label>
            <input
              type="password"
              value={profileForm.newPassword}
              onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setProfileOpen(false)}
              className="px-4 py-2 text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-teal-600 text-white rounded-md"
            >
              Save Profile
            </button>
          </div>
        </form>
      </Modal>
      <OfflineIndicator />
    </>
  );
}
