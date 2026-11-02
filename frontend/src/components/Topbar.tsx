import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../api/client';
import { ChevronDown, LogOut, KeyRound, Radio, AlertCircle, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

interface TopbarProps {
  onOpenChangePassword: () => void;
}

interface HealthStatus {
  online: boolean;
  dbConnected: boolean;
  latencyMs?: number;
  isDemoMode: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenChangePassword }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [health, setHealth] = useState<HealthStatus>({
    online: true,
    dbConnected: true,
    isDemoMode: localStorage.getItem('stockguard_demo_mode') === 'true',
  });

  // Check health periodically
  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      const isDemo = localStorage.getItem('stockguard_demo_mode') === 'true';
      if (isDemo) {
        if (mounted) setHealth({ online: true, dbConnected: true, isDemoMode: true });
        return;
      }

      try {
        const res = await apiClient.get('/health', { timeout: 3500 });
        if (mounted) {
          setHealth({
            online: res.data.status === 'healthy',
            dbConnected: res.data.database === 'connected',
            latencyMs: res.data.database_latency_ms,
            isDemoMode: false,
          });
        }
      } catch {
        if (mounted) {
          setHealth({
            online: false,
            dbConnected: false,
            isDemoMode: false,
          });
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    const handleOnline = () => setHealth((prev) => ({ ...prev, online: true, dbConnected: true }));
    const handleOffline = () => setHealth((prev) => ({ ...prev, online: false, dbConnected: false }));

    window.addEventListener('stockguard:backend_online', handleOnline);
    window.addEventListener('stockguard:network_error', handleOffline);

    return () => {
      mounted = false;
      clearInterval(interval);
      window.removeEventListener('stockguard:backend_online', handleOnline);
      window.removeEventListener('stockguard:network_error', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-mono uppercase font-semibold">Admin</span>;
      case 'manager':
        return <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">Manager</span>;
      case 'warehouse_staff':
        return <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-medium">Warehouse Staff</span>;
      case 'delivery_agent':
        return <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium">Delivery Agent</span>;
      default:
        return <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{role || 'Staff'}</span>;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Left section: live health / connection badge */}
      <div className="flex items-center gap-3">
        {health.isDemoMode ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-medium">
            <Zap className="w-3.5 h-3.5" />
            <span>Standalone Demo Mode</span>
          </div>
        ) : health.online && health.dbConnected ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
              <span>Database Engine Online</span>
              {health.latencyMs != null && (
                <span className="text-[10px] font-mono text-slate-400">({health.latencyMs}ms)</span>
              )}
            </span>
          </div>
        ) : health.online ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium text-amber-700">API Active · DB Degraded</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-xs font-medium text-rose-700">Backend Server Offline</span>
          </div>
        )}
      </div>

      {/* Right section: user profile dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-3 p-1.5 pl-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-left"
        >
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                {user?.name || 'Staff User'}
              </span>
              {getRoleBadge(user?.role)}
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-tight mt-0.5">
              {user?.email}
            </p>
          </div>

          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>

          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3.5 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-900">{user?.name}</p>
              <p className="text-[11px] text-slate-500 font-mono truncate">{user?.email}</p>
            </div>

            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenChangePassword();
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Password</span>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-1">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
