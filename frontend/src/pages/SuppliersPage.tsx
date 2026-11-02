import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  listSuppliersApi,
  createSupplierApi,
  updateSupplierApi,
  deleteSupplierApi,
} from '../api/suppliers';
import { Supplier, SupplierCreatePayload } from '../types/procurement';
import { useAuth } from '../hooks/useAuth';
import SupplierProductsPanel from '../components/SupplierProductsPanel';
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  X,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Package,
  ChevronRight,
} from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();
  const { isAdmin } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected supplier for product catalogue panel
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierCreatePayload>({
    name: '',
    email: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await listSuppliersApi();
      setSuppliers(data);
      if (data.length > 0 && !selectedSupplier) {
        setSelectedSupplier(data[0]);
      }
    } catch (err: any) {
      showToast('Failed to load supplier directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({ name: '', email: '', phone: '' });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name,
      email: sup.email || '',
      phone: sup.phone || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }

    if (!formData.email?.trim() && !formData.phone?.trim()) {
      setFormError('At least one contact method (email or phone number) must be provided.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
      };

      if (editingSupplier) {
        await updateSupplierApi(editingSupplier.id, payload);
        showToast(`Supplier '${payload.name}' updated!`);
      } else {
        await createSupplierApi(payload);
        showToast(`Supplier '${payload.name}' registered!`);
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Operation failed.';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (sup: Supplier) => {
    if (!window.confirm(`Delete supplier '${sup.name}'?`)) return;
    try {
      await deleteSupplierApi(sup.id);
      showToast(`Supplier '${sup.name}' removed.`);
      if (selectedSupplier?.id === sup.id) {
        setSelectedSupplier(null);
      }
      fetchSuppliers();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete supplier.');
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Suppliers & Vendors</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vendor contact directory, contractual product pricing, and lead times.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Vendor</span>
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center justify-between shadow-2xs">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search suppliers by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors"
          />
        </div>

        <button
          onClick={fetchSuppliers}
          title="Refresh List"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 self-end md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suppliers List */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Vendor</th>
                    <th className="px-5 py-3">Contact Email</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                          <span>Loading suppliers...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-400">
                        No suppliers found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((sup) => (
                      <tr
                        key={sup.id}
                        onClick={() => setSelectedSupplier(sup)}
                        className={`cursor-pointer transition-colors ${
                          selectedSupplier?.id === sup.id
                            ? 'bg-slate-50 font-medium'
                            : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200">
                              {sup.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{sup.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID #{sup.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600">
                          {sup.email ? (
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span>{sup.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600">
                          {sup.phone ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{sup.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td
                          className="px-5 py-3.5 text-right space-x-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setSelectedSupplier(sup)}
                            title="Manage Catalogue"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditModal(sup)}
                                title="Edit Vendor"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(sup)}
                                title="Delete Vendor"
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Supplier Products Catalogue Panel */}
        <div>
          {selectedSupplier ? (
            <SupplierProductsPanel
              supplier={selectedSupplier}
              showToast={showToast}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
              Select a supplier on the left to view and configure linked products.
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingSupplier ? 'Edit Supplier' : 'Register New Supplier'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Company / Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Industrial Supplies Pvt Ltd"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Corporate Email</label>
                <input
                  type="email"
                  placeholder="orders@apexsupplies.co.in"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Direct Phone (+91)</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <p className="text-[11px] text-slate-400">
                Note: At least one of email or phone is required by database check constraints.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Register Vendor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;

