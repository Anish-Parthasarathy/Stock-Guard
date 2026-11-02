import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listWarehousesApi, createWarehouseApi, getWarehouseApi } from '../api/warehouses';
import { Warehouse, WarehouseCreatePayload } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import {
  Warehouse as WarehouseIcon,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  X,
  MapPin,
  Boxes,
  Building,
} from 'lucide-react';

export const WarehousesPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();
  const { isAdmin } = useAuth();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState<Warehouse | null>(null);

  // Create Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<WarehouseCreatePayload>({
    name: '',
    location: '',
    capacity: 5000,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchWarehouses = async () => {
    setLoading(true);
    try {
      const data = await listWarehousesApi();
      setWarehouses(data);
    } catch (err: any) {
      showToast('Could not load warehouse list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) {
      setSearchResult(null);
      return;
    }
    setLoading(true);
    try {
      const wh = await getWarehouseApi({ id: Number(searchId) });
      setSearchResult(wh);
    } catch (err: any) {
      showToast(err.response?.data?.detail || `Warehouse #${searchId} not found.`);
      setSearchResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.capacity <= 0) {
      setFormError('Storage capacity must be greater than 0.');
      return;
    }

    setFormSubmitting(true);
    try {
      const created = await createWarehouseApi(formData);
      showToast(`Warehouse facility '${created.name}' created!`);
      setShowAddModal(false);
      setFormData({ name: '', location: '', capacity: 5000 });
      fetchWarehouses();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create warehouse.';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setFormSubmitting(false);
    }
  };

  const displayedList = searchResult ? [searchResult] : warehouses;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Logistics Warehouses</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Storage facility master registry, capacities, and distribution hubs.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Facility</span>
          </button>
        )}
      </div>

      {/* Search / Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center justify-between shadow-2xs">
        <form onSubmit={handleLookup} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min={1}
              placeholder="Find by Warehouse ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg font-medium transition-colors border border-slate-200"
          >
            Find
          </button>
          {searchResult && (
            <button
              type="button"
              onClick={() => {
                setSearchResult(null);
                setSearchId('');
                fetchWarehouses();
              }}
              className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs"
            >
              Clear
            </button>
          )}
        </form>

        <button
          onClick={fetchWarehouses}
          title="Refresh List"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 self-end md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Facilities Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
            <span className="text-xs">Loading logistics facility registry...</span>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-white border border-slate-200 rounded-xl">
            No warehouses registered in the system yet.
          </div>
        ) : (
          displayedList.map((wh) => (
            <div
              key={wh.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:border-slate-300 transition-colors flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                    <WarehouseIcon className="w-4 h-4" />
                  </div>
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                    ID #{wh.id}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  {wh.name || `Facility #${wh.id}`}
                </h3>
                <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{wh.location}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Capacity:</span>
                <span className="font-bold text-slate-800">{wh.capacity.toLocaleString('en-IN')} units</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Provision Warehouse Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <WarehouseIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Add Logistics Facility</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWarehouse} className="p-6 space-y-3.5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Facility Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. West Zone Central Hub - Bhiwandi"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Physical Location Address (with PIN Code)</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Plot 14, Logistics Park, Bhiwandi, Thane, Maharashtra - 421302"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Storage Capacity (Units)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
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
                  <span>{formSubmitting ? 'Registering...' : 'Register Facility'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehousesPage;

