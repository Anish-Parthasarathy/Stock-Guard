import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listUsersApi, createUserApi, adminResetPasswordApi } from '../api/auth';
import { User, UserRole, UserCreatePayload } from '../types/auth';
import { formatDateIN } from '../utils/formatters';
import {
  Users as UsersIcon,
  UserPlus,
  KeyRound,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  X,
  Shield,
  Building2,
  Calendar,
} from 'lucide-react';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Inventory Manager' },
  { value: 'warehouse_staff', label: 'Warehouse Staff' },
  { value: 'delivery_agent', label: 'Delivery Agent' },
];

export const UsersPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);

  // Add User Form State
  const [formData, setFormData] = useState<UserCreatePayload>({
    name: '',
    email: '',
    password: '',
    role: 'warehouse_staff',
    warehouse_id: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Reset Password State
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await listUsersApi({
        role: roleFilter || undefined,
        warehouse_id: warehouseFilter ? Number(warehouseFilter) : undefined,
      });
      setUsers(data);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, warehouseFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.password.length < 8) {
      setFormError('Temporary password must be at least 8 characters long.');
      return;
    }

    setFormSubmitting(true);
    try {
      await createUserApi({
        ...formData,
        warehouse_id: formData.warehouse_id ? Number(formData.warehouse_id) : null,
      });
      showToast(`User account created for ${formData.name}`);
      setShowAddModal(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'warehouse_staff',
        warehouse_id: null,
      });
      loadUsers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to provision user.';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetError(null);

    if (resetPassword.length < 8) {
      setResetError('New password must be at least 8 characters long.');
      return;
    }

    setResetSubmitting(true);
    try {
      await adminResetPasswordApi(resetTargetUser.id, { new_password: resetPassword });
      showToast(`Password updated for ${resetTargetUser.name}`);
      setResetTargetUser(null);
      setResetPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to reset password.';
      setResetError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setResetSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-mono font-semibold">ADMIN</span>;
      case 'manager':
        return <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">MANAGER</span>;
      case 'warehouse_staff':
        return <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-medium">STAFF</span>;
      case 'delivery_agent':
        return <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium">DELIVERY</span>;
      default:
        return <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{role}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Staff & Access Control</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administer internal employee accounts, roles, and facility assignments.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Provision New Account</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center justify-between shadow-2xs">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={1}
            placeholder="Warehouse ID"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />

          <button
            onClick={loadUsers}
            title="Refresh List"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Assigned Facility</th>
                <th className="px-5 py-3">Enrolled</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      <span>Loading user directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    No matching user accounts found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-semibold flex items-center justify-center text-xs border border-slate-200">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{user.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{getRoleBadge(user.role)}</td>
                    <td className="px-5 py-3.5">
                      {user.warehouse_id ? (
                        <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          Warehouse #{user.warehouse_id}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Global HQ</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                      {formatDateIN(user.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setResetTargetUser(user)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded text-xs transition-colors"
                      >
                        <KeyRound className="w-3 h-3 text-slate-400" />
                        <span>Reset Password</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision New Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Provision User Account</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-3.5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  placeholder="john.doe@stockguard.test"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Facility ID (Optional)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="e.g. 1"
                    value={formData.warehouse_id || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        warehouse_id: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Initial Temporary Password <span className="text-slate-400 font-normal">(min 8 chars)</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Set initial password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{formSubmitting ? 'Creating...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Override Password</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{resetTargetUser.name}</p>
                </div>
              </div>
              <button
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-3.5 text-xs">
              {resetError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {resetError}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  New Password <span className="text-slate-400 font-normal">(min 8 chars)</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Enter new credential"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {resetSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{resetSubmitting ? 'Updating...' : 'Set Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;

