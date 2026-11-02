import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ChangePasswordModal from './ChangePasswordModal';
import SimulatorDrawer from './SimulatorDrawer';

export const Layout: React.FC = () => {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  useEffect(() => {
    const handleNetworkError = (e: any) => {
      showToast(e.detail || 'Backend server is currently offline.');
    };
    const handleConflict = (e: any) => {
      showToast(`⚠️ ${e.detail || 'Data conflict occurred. Please refresh.'}`);
    };

    window.addEventListener('stockguard:network_error', handleNetworkError);
    window.addEventListener('stockguard:conflict', handleConflict);

    return () => {
      window.removeEventListener('stockguard:network_error', handleNetworkError);
      window.removeEventListener('stockguard:conflict', handleConflict);
    };
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar onOpenSimulator={() => setSimulatorOpen(true)} />

      {/* Body Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Topbar onOpenChangePassword={() => setChangePasswordOpen(true)} />

        {/* Dynamic Page Outlet */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet context={{ showToast }} />
          </div>
        </main>
      </div>

      {/* Self-service Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* API Simulator Drawer */}
      <SimulatorDrawer
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
      />
    </div>
  );
};

export default Layout;

