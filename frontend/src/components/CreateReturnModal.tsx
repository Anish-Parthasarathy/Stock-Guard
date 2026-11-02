import React, { useState } from 'react';
import { createReturnApi } from '../api/returns';
import { Order, ReturnCreatePayload, ReturnItemCreatePayload } from '../types/fulfillment';
import { Product } from '../types/inventory';
import { RotateCcw, X, Loader2 } from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface CreateReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  allProducts: Product[];
  onSuccess: () => void;
  showToast: (msg: string) => void;
}

export const CreateReturnModal: React.FC<CreateReturnModalProps> = ({
  isOpen,
  onClose,
  order,
  allProducts,
  onSuccess,
  showToast,
}) => {
  const [returnType, setReturnType] = useState<'REFUND' | 'REPLACEMENT'>('REFUND');
  const [reason, setReason] = useState('Customer return: Wrong size / defective unit');
  const [returnItems, setReturnItems] = useState<{ [itemId: number]: number }>(() => {
    const initial: { [itemId: number]: number } = {};
    order.items.forEach((it) => {
      initial[it.id] = it.quantity;
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getProductName = (productId: number) => {
    return allProducts.find((p) => p.id === productId)?.name || `Product #${productId}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const itemsToReturn: ReturnItemCreatePayload[] = [];
    order.items.forEach((it) => {
      const qty = returnItems[it.id] || 0;
      if (qty > 0) {
        itemsToReturn.push({
          order_contains_id: it.id,
          product_id: it.product_id,
          warehouse_id: order.warehouse_id,
          quantity_expected: qty,
          return_unit_price: Number(it.unit_price),
        });
      }
    });

    if (itemsToReturn.length === 0) {
      setError('Please select at least one item to return.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: ReturnCreatePayload = {
        order_id: order.id,
        reason: reason.trim(),
        return_type: returnType,
        items: itemsToReturn,
      };

      await createReturnApi(payload);
      showToast(`Return request authorized for Order #${order.id}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create return.';
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
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Authorize Return Request</h3>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Return Action</label>
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="REFUND">Customer Refund</option>
                <option value="REPLACEMENT">Item Replacement</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Return Destination</label>
              <input
                type="text"
                disabled
                value={`Warehouse #${order.warehouse_id}`}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Return Reason</label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Items to return selection */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-800 block">Select Quantities to Return</span>
            <div className="space-y-2">
              {order.items.map((it) => (
                <div
                  key={it.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-slate-900">{getProductName(it.product_id)}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Purchased: {it.quantity} units @ {formatINR(it.unit_price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] text-slate-400">Qty:</label>
                    <input
                      type="number"
                      min={0}
                      max={it.quantity}
                      value={returnItems[it.id] ?? 0}
                      onChange={(e) =>
                        setReturnItems((prev) => ({
                          ...prev,
                          [it.id]: Number(e.target.value),
                        }))
                      }
                      className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
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
              <span>{submitting ? 'Submitting...' : 'Authorize Return'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateReturnModal;

