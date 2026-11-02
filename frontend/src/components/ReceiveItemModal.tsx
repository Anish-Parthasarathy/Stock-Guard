import React, { useState } from 'react';
import { receivePOItemApi } from '../api/purchaseOrders';
import { PurchaseOrder, PurchaseOrderItem } from '../types/procurement';
import { PackageCheck, X, Loader2, AlertCircle } from 'lucide-react';

interface ReceiveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder;
  item: PurchaseOrderItem | null;
  productName?: string;
  onSuccess: () => void;
  showToast: (msg: string) => void;
}

export const ReceiveItemModal: React.FC<ReceiveItemModalProps> = ({
  isOpen,
  onClose,
  po,
  item,
  productName,
  onSuccess,
  showToast,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [conditionNotes, setConditionNotes] = useState<string>('Goods received in good condition.');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  // Calculate already received quantity for this specific line item
  const alreadyReceived = po.receipts
    ? po.receipts
        .filter((r) => r.purchase_order_contains_id === item.id)
        .reduce((sum, r) => sum + r.quantity_received, 0)
    : 0;

  const remainingQuantity = Math.max(0, item.quantity_ordered - alreadyReceived);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantity <= 0) {
      setError('Received quantity must be at least 1 unit.');
      return;
    }

    if (quantity > remainingQuantity) {
      setError(
        `Cannot receive ${quantity} units. Only ${remainingQuantity} units remaining for this line item.`
      );
      return;
    }

    setSubmitting(true);
    try {
      await receivePOItemApi(po.id, {
        purchase_order_contains_id: item.id,
        quantity_received: Number(quantity),
        condition_notes: conditionNotes.trim() || undefined,
      });
      showToast(`Successfully recorded receipt of ${quantity} units! Inventory updated.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to record receipt.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Record Shipment Receipt</h3>
              <p className="text-xs text-slate-500 font-mono">PO #{po.id} · Item #{item.id}</p>
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
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Item details card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900">
                {productName || `Product #${item.product_id}`}
              </span>
              <span className="font-mono text-slate-500">WH #{item.warehouse_id}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 font-mono text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Ordered</span>
                <span className="font-bold text-slate-900">{item.quantity_ordered}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Received</span>
                <span className="font-bold text-emerald-700">{alreadyReceived}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Remaining</span>
                <span className="font-bold text-amber-700">{remainingQuantity}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Quantity Received in This Batch
            </label>
            <input
              type="number"
              min={1}
              max={remainingQuantity}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Condition & Inspection Notes
            </label>
            <textarea
              rows={2}
              required
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              placeholder="Package integrity, barcode verification, storage location notes..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || remainingQuantity === 0}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{submitting ? 'Updating Inventory...' : 'Confirm Receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiveItemModal;

