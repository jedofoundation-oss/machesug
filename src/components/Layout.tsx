import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  FlaskConical,
  ScanLine,
  Pill,
  BedDouble,
  Receipt,
  Baby,
  BriefcaseMedical,
  HeartHandshake,
  ShieldCheck,
  Bell,
  LogOut,
  Menu,
  X,
  UserCircle2,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import type { NotificationItem, User } from '../types/hmis';
import { formatDateTime } from '../lib/api';
import { PWAInstallButton } from './PWAInstallButton';

export type NavSection =
  | 'dashboard'
  | 'patients'
  | 'consultations'
  | 'laboratory'
  | 'radiology'
  | 'pharmacy'
  | 'inpatient'
  | 'billing'
  | 'maternity'
  | 'hr'
  | 'donations'
  | 'admin';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Clinical' | 'Diagnostics & Meds' | 'Operations & Finance' | 'Administration';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Clinical' },
  { id: 'patients', label: 'Patients & Triage', icon: Users, group: 'Clinical' },
  { id: 'consultations', label: 'Consultations', icon: Stethoscope, group: 'Clinical' },
  { id: 'inpatient', label: 'Wards & Inpatient', icon: BedDouble, group: 'Clinical' },
  { id: 'maternity', label: 'Maternity', icon: Baby, group: 'Clinical' },
  { id: 'laboratory', label: 'Laboratory', icon: FlaskConical, group: 'Diagnostics & Meds' },
  { id: 'radiology', label: 'Radiology', icon: ScanLine, group: 'Diagnostics & Meds' },
  { id: 'pharmacy', label: 'Pharmacy & Stock', icon: Pill, group: 'Diagnostics & Meds' },
  { id: 'billing', label: 'Billing & Finance', icon: Receipt, group: 'Operations & Finance' },
  { id: 'hr', label: 'Human Resources', icon: BriefcaseMedical, group: 'Operations & Finance' },
  { id: 'donations', label: 'Donations', icon: HeartHandshake, group: 'Operations & Finance' },
  { id: 'admin', label: 'Users & Roles', icon: ShieldCheck, group: 'Administration' },
];

interface LayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  currentUser: User;
  allowedModules: string[];
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onClearReadNotifications: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  activeSection,
  onNavigate,
  currentUser,
  allowedModules,
  notifications,
  onMarkNotificationRead,
  onClearReadNotifications,
  onOpenProfile,
  onLogout,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const activeMeta = NAV_ITEMS.find((n) => n.id === activeSection);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    (item) => currentUser.role === 'Admin' || allowedModules.includes(item.id)
  );

  const groups: NavItem['group'][] = [
    'Clinical',
    'Diagnostics & Meds',
    'Operations & Finance',
    'Administration',
  ];

  const handleSelect = (id: NavSection) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/45 z-40 lg:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-out no-print ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-base font-bold tracking-tight text-white">MachesHMS</div>
            <div className="text-xs text-slate-400">MachesUg Clinical Facility</div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => {
            const items = visibleItems.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-3 mb-1.5 text-[11px] font-medium text-slate-400 tracking-wide">
                  {group}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-teal-600 text-white font-medium'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-slate-800 space-y-2.5">
          <PWAInstallButton variant="sidebar" />
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>Branch: MachesUg</span>
            <span className="font-mono">{currentUser.role}</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar (3-zone contract) */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center justify-between gap-4 no-print">
          {/* Zone 1: Breadcrumb / Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-400 whitespace-nowrap">MachesUg</span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">/</span>
              <h1 className="font-semibold text-slate-900 truncate">
                {activeMeta?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          {/* Zone 2 & 3: Install, Notifications, User Profile, Sign Out */}
          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton variant="header" />
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded bg-rose-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      Notifications ({unreadCount} unread)
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => onMarkNotificationRead('all')}
                          className="inline-flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900 font-medium"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Mark all read</span>
                        </button>
                      )}
                      {notifications.some((n) => n.is_read) && (
                        <button
                          type="button"
                          onClick={onClearReadNotifications}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600"
                          title="Clear read notifications"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-500">
                        No notifications
                      </div>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (!n.is_read) onMarkNotificationRead(n.id);
                            if (NAV_ITEMS.some((x) => x.id === n.link)) {
                              onNavigate(n.link as NavSection);
                            }
                            setNotifOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            n.is_read ? 'opacity-60' : 'bg-teal-50/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {n.title}
                            </span>
                            <span className="text-[11px] text-slate-400 shrink-0">
                              {n.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
                            {formatDateTime(n.created_at)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <UserCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
              <span className="font-medium hidden sm:inline">{currentUser.full_name}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        {/* Quiet Footer */}
        <footer className="px-6 py-4 border-t border-slate-200 bg-white text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 no-print">
          <span>&copy; 2026 MachesHMS — All Rights Reserved by Maches UG</span>
          <span>MyHealth Hospital Management Information System</span>
        </footer>
      </div>
    </div>
  );
};
