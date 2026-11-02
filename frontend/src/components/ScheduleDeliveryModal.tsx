import React, { useState } from 'react';
import { scheduleDeliveryApi } from '../api/deliveries';
import { Order, DeliveryCreatePayload } from '../types/fulfillment';
import { Truck, X, Loader2 } from 'lucide-react';

interface ScheduleDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSuccess: () => void;
  showToast: (msg: string) => void;
}

export const ScheduleDeliveryModal: React.FC<ScheduleDeliveryModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
  showToast,
}) => {
  const [agentId, setAgentId] = useState<number>(1);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = new Date(Date.now() + 24 * 3600000);
    return d.toISOString().slice(0, 16);
  });
  const [deliveryAddress, setDeliveryAddress] = useState<string>('Plot 42, Sector 18, Udyog Vihar, Gurugram, Haryana - 122015');
  const [deliveryFor, setDeliveryFor] = useState<string>('Customer Recipient');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: DeliveryCreatePayload = {
        order_id: order.id,
        agent_id: Number(agentId),
        scheduled_at: new Date(scheduledAt).toISOString(),
        delivery_address: deliveryAddress.trim(),
        delivery_for: deliveryFor.trim(),
      };

      await scheduleDeliveryApi(payload);
      showToast(`Delivery scheduled for Order #${order.id}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to schedule delivery.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Schedule Order Dispatch</h3>
              <p className="text-xs text-slate-500 font-mono">Order #{order.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Delivery Agent ID</label>
              <input
                type="number"
                min={1}
                required
                value={agentId}
                onChange={(e) => setAgentId(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Scheduled Time</label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Recipient Name / Contact</label>
            <input
              type="text"
              required
              value={deliveryFor}
              onChange={(e) => setDeliveryFor(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Delivery Address (with PIN Code)</label>
            <textarea
              rows={2}
              required
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
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
              <span>{submitting ? 'Scheduling...' : 'Schedule Delivery'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleDeliveryModal;

