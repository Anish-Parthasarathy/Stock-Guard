import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Lock, Mail, Loader2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('admin@stockguard.test');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    localStorage.removeItem('stockguard_demo_mode');

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Authentication failed. Please verify credentials.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleEnterDemoMode = () => {
    localStorage.setItem('stockguard_demo_mode', 'true');
    localStorage.setItem('stockguard_access_token', 'demo-jwt-token-active');
    localStorage.setItem('stockguard_refresh_token', 'demo-refresh-token-active');
    localStorage.setItem(
      'stockguard_user',
      JSON.stringify({
        id: 1,
        name: 'Parth (Demo Admin)',
        email: 'admin@stockguard.in',
        role: 'admin',
        warehouse_id: 1,
        created_at: new Date().toISOString(),
      })
    );
    window.location.href = '/dashboard';
  };

  const setDemoCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 selection:bg-slate-900 selection:text-white">
      <div className="w-full max-w-sm">
        {/* Brand logo header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 rounded-xl bg-slate-900 text-white items-center justify-center font-bold text-base shadow-sm mb-3">
            SG
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">StockGuard WMS</h1>
          <p className="text-xs text-slate-500 mt-1">Enterprise Inventory & Fulfillment Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Corporate Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@stockguard.test"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Access Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {/* Standalone Demo Mode Option */}
            <div className="relative flex py-2 items-center">
              <div className="grow border-t border-slate-200"></div>
              <span className="shrink mx-2 text-[10px] text-slate-400 uppercase font-medium">Or</span>
              <div className="grow border-t border-slate-200"></div>
            </div>

            <button
              type="button"
              onClick={handleEnterDemoMode}
              className="w-full py-2 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-900 border border-purple-200/80 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span>Explore Standalone Demo Mode</span>
            </button>
          </form>

          {/* Quick Demo Pre-fills */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Quick Test Accounts
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@stockguard.test', 'Password123!')}
                className="px-2 py-1 text-left bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors truncate"
              >
                Admin (Full Access)
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('staff1@stockguard.test', 'StaffPass123!')}
                className="px-2 py-1 text-left bg-slate-50 hover:bg-slate-100 text-slate-700 rounded border border-slate-200 transition-colors truncate"
              >
                Staff (Warehouse 1)
              </button>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Role-Based DBMS Concurrency & Session Security</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

