import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listDeliveriesApi, updateDeliveryStatusApi } from '../api/deliveries';
import { Delivery, DeliveryStatusUpdatePayload } from '../types/fulfillment';
import { formatDateTimeIN } from '../utils/formatters';
import {
  Truck,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  X,
  MapPin,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

export const DeliveriesPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState<number | ''>('');

  // Status update modal state
  const [targetDelivery, setTargetDelivery] = useState<Delivery | null>(null);
  const [nextStatus, setNextStatus] = useState<DeliveryStatusUpdatePayload['status']>('OUT_FOR_DELIVERY');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const data = await listDeliveriesApi({
        status: statusFilter || undefined,
        agent_id: agentFilter ? Number(agentFilter) : undefined,
      });
      setDeliveries(data);
    } catch {
      showToast('Failed to load delivery runs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [statusFilter, agentFilter]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDelivery) return;
    setUpdating(true);
    setUpdateError(null);
    try {
      await updateDeliveryStatusApi(targetDelivery.id, {
        status: nextStatus,
        delivered_to: deliveredTo.trim() || undefined,
      });
      showToast(`Delivery #${targetDelivery.id} updated to ${nextStatus}!`);
      setTargetDelivery(null);
      fetchDeliveries();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to update delivery.';
      setUpdateError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'DELIVERED':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">DELIVERED</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">IN TRANSIT</span>;
      case 'FAILED':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">FAILED</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">SCHEDULED</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivery Logistics</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fleet dispatch, agent assignments, delivery tracking, and drop-off confirmations.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Delivery Statuses</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="FAILED">FAILED</option>
          </select>

          <input
            type="number"
            min={1}
            placeholder="Filter by Agent ID..."
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value ? Number(e.target.value) : '')}
            className="w-40 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <button
          onClick={fetchDeliveries}
          title="Refresh List"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Deliveries Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Dispatch #</th>
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">Assigned Agent</th>
                <th className="px-5 py-3">Scheduled Date</th>
                <th className="px-5 py-3">Recipient & Address</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      <span>Loading delivery schedule...</span>
                    </div>
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No active deliveries found. Schedule dispatches from paid orders.
                  </td>
                </tr>
              ) : (
                deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      DEL #{del.id}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-700">
                      Order #{del.order_id}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-700">
                      Agent #{del.agent_id}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-500">
                      {formatDateTimeIN(del.scheduled_at)}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="font-semibold text-slate-900">{del.delivery_for}</div>
                      <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{del.delivery_address}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(del.status)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {del.status !== 'DELIVERED' && (
                        <button
                          onClick={() => {
                            setTargetDelivery(del);
                            setNextStatus(
                              del.status === 'SCHEDULED' ? 'OUT_FOR_DELIVERY' : 'DELIVERED'
                            );
                            setDeliveredTo(del.delivered_to || '');
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors"
                        >
                          Update Status
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Delivery Status Modal */}
      {targetDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Update Delivery #{targetDelivery.id}</h3>
              <button
                onClick={() => setTargetDelivery(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="p-6 space-y-3.5 text-xs">
              {updateError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {updateError}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">New Operational State</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900"
                >
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="OUT_FOR_DELIVERY">OUT FOR DELIVERY</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              {nextStatus === 'DELIVERED' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Delivered To (Signature / Name)</label>
                  <input
                    type="text"
                    required
                    placeholder="Recipient signature / Receptionist"
                    value={deliveredTo}
                    onChange={(e) => setDeliveredTo(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTargetDelivery(null)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{updating ? 'Updating...' : 'Save Status'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveriesPage;

