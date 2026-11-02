import React, { useState, useEffect } from 'react';
import { fetchUsers, createUser, adminResetPassword, fetchWarehouses } from '../api/auth';

const ROLES = [
  { value: 'admin', label: 'Administrator', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { value: 'manager', label: 'Inventory Manager', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { value: 'warehouse_staff', label: 'Warehouse Staff', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 'delivery_agent', label: 'Delivery Agent', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
];

export default function UserManagementView({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [toast, setToast] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);

  // Add Employee Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'warehouse_staff',
    warehouse_id: '',
  });
  const [formError, setFormError] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Reset Password Form State
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, whData] = await Promise.all([
        fetchUsers({
          role: roleFilter || undefined,
          warehouse_id: warehouseFilter || undefined,
        }),
        fetchWarehouses(),
      ]);
      setUsers(userData);
      setWarehouses(whData || []);
    } catch (err) {
      showToast(err.message || 'Failed to fetch employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [roleFilter, warehouseFilter]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (formData.password.length < 8) {
      setFormError('Temporary password must be at least 8 characters long.');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        warehouse_id: formData.warehouse_id ? parseInt(formData.warehouse_id, 10) : null,
      };

      await createUser(payload);
      showToast(`Employee ${payload.name} provisioned successfully!`);
      setShowAddModal(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'warehouse_staff',
        warehouse_id: '',
      });
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to provision employee.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError(null);

    if (resetPassword.length < 8) {
      setResetError('New password must be at least 8 characters long.');
      return;
    }

    setResetSubmitting(true);
    try {
      await adminResetPassword(resetTargetUser.id, resetPassword);
      showToast(`Password for ${resetTargetUser.name} reset successfully!`);
      setResetTargetUser(null);
      setResetPassword('');
    } catch (err) {
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const getRoleBadge = (role) => {
    const item = ROLES.find((r) => r.value === role) || {
      label: role,
      color: 'bg-slate-800 text-slate-300 border-slate-700',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.color}`}>
        {item.label}
      </span>
    );
  };

  const counts = {
    total: users.length,
    admins: users.filter((u) => u.role === 'admin').length,
    staff: users.filter((u) => u.role === 'warehouse_staff').length,
    agents: users.filter((u) => u.role === 'delivery_agent').length,
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm flex items-center gap-3 transition-all ${
            toast.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current animate-ping" />
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Employee Directory & Access</h1>
          <p className="text-sm text-slate-400">
            Provision staff credentials, assign logistics warehouses, and manage account security.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Employee
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs font-medium text-slate-400">Total Accounts</p>
          <p className="text-2xl font-bold text-white mt-1">{counts.total}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs font-medium text-purple-400">Administrators</p>
          <p className="text-2xl font-bold text-white mt-1">{counts.admins}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs font-medium text-amber-400">Warehouse Staff</p>
          <p className="text-2xl font-bold text-white mt-1">{counts.staff}</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
          <p className="text-xs font-medium text-emerald-400">Delivery Agents</p>
          <p className="text-2xl font-bold text-white mt-1">{counts.agents}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <svg
            className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          {warehouses.length > 0 && (
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name || `Warehouse #${wh.id}`}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={loadData}
            title="Refresh List"
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Warehouse Assignment</th>
                <th className="px-6 py-4">Enrolled On</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5 text-indigo-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Loading employee records...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    No employee accounts found matching the current criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 font-semibold flex items-center justify-center border border-indigo-500/20 text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getRoleBadge(user.role)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.warehouse_id ? (
                        <span className="text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                          Warehouse #{user.warehouse_id}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Global (Unassigned)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                      {new Date(user.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setResetTargetUser(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Provision New Employee</h3>
                  <p className="text-xs text-slate-400">Assign roles and initial system credentials</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl flex items-start gap-2">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Maya Lin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. maya.lin@stockguard.test"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                    Assigned Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                    Warehouse
                  </label>
                  <select
                    value={formData.warehouse_id}
                    onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None / Unassigned</option>
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name || `Warehouse #${wh.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                  Temporary Initial Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Set employee temporary password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  The employee can log in with this password and immediately update it via their account menu.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  {formSubmitting ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Reset Employee Password</h3>
                  <p className="text-xs text-slate-400">{resetTargetUser.name} ({resetTargetUser.email})</p>
                </div>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {resetError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-xl flex items-start gap-2">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{resetError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
                  New Temporary Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter new credentials"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  This will immediately override the current password for this employee account.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  disabled={resetSubmitting}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2"
                >
                  {resetSubmitting ? 'Overriding...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
