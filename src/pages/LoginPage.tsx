import React, { useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { User } from '../types/hmis';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold text-slate-900">MachesHMS</div>
            <p className="text-xs text-slate-500 mt-1">
              MachesUg Hospital Management Information System
            </p>
          </div>
          <PWAInstallButton variant="header" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Signing in...' : 'Sign In to Workspace'}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
          <div className="font-medium text-slate-700">Quick Staff Accounts</div>
          <div className="flex items-center justify-between">
            <span>Admin: <code className="font-mono text-slate-800">admin</code> / <code className="font-mono">password123</code></span>
            <button
              type="button"
              onClick={() => {
                setUsername('admin');
                setPassword('password123');
              }}
              className="text-teal-700 hover:underline"
            >
              Fill
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span>Doctor: <code className="font-mono text-slate-800">ckamo</code> / <code className="font-mono">password123</code></span>
            <button
              type="button"
              onClick={() => {
                setUsername('ckamo');
                setPassword('password123');
              }}
              className="text-teal-700 hover:underline"
            >
              Fill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
