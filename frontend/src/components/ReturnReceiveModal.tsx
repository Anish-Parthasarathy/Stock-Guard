import React, { useState } from 'react';
import { receiveReturnItemApi } from '../api/returns';
import { ReturnOrder, ReturnItem, ReturnReceiptCreatePayload } from '../types/fulfillment';
import { PackageCheck, X, Loader2 } from 'lucide-react';

interface ReturnReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnOrder: ReturnOrder;
  item: ReturnItem | null;
  productName?: string;
  onSuccess: () => void;
  showToast: (msg: string) => void;
}

export const ReturnReceiveModal: React.FC<ReturnReceiveModalProps> = ({
  isOpen,
  onClose,
  returnOrder,
  item,
  productName,
  onSuccess,
  showToast,
}) => {
  const [quantity, setQuantity] = useState<number>(item?.quantity_expected || 1);
  const [conditionStatus, setConditionStatus] = useState<'GOOD' | 'DAMAGED' | 'DEFECTIVE'>('GOOD');
  const [dispositionStatus, setDispositionStatus] = useState<'RESTOCKED' | 'QUARANTINED' | 'SCRAPPED'>('RESTOCKED');
  const [conditionNotes, setConditionNotes] = useState('Inspected returned physical item at facility dock');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      setError('Received quantity must be greater than 0.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload: ReturnReceiptCreatePayload = {
        return_contains_id: item.id,
        quantity_received: Number(quantity),
        condition_status: conditionStatus,
        status: dispositionStatus,
        condition_notes: conditionNotes.trim(),
      };

      await receiveReturnItemApi(returnOrder.id, payload);
      showToast(`Return receipt recorded! Stock updated per disposition.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to receive return item.';
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
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Process Returned Shipment</h3>
              <p className="text-xs text-slate-500 font-mono">Return #{returnOrder.id} · Item #{item.id}</p>
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

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="font-semibold text-slate-900 block">
              {productName || `Product #${item.product_id}`}
            </span>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Authorized Return Qty: {item.quantity_expected} units
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Physical Condition</label>
              <select
                value={conditionStatus}
                onChange={(e) => setConditionStatus(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="GOOD">Good / Resalable</option>
                <option value="DAMAGED">Damaged Package</option>
                <option value="DEFECTIVE">Defective Hardware</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Inventory Disposition</label>
              <select
                value={dispositionStatus}
                onChange={(e) => setDispositionStatus(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
              >
                <option value="RESTOCKED">Restock to Inventory</option>
                <option value="QUARANTINED">Hold in Quarantine</option>
                <option value="SCRAPPED">Scrap / Write-off</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Quantity Received</label>
            <input
              type="number"
              min={1}
              max={item.quantity_expected}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Inspection Notes</label>
            <textarea
              rows={2}
              required
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
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
              <span>{submitting ? 'Recording...' : 'Process Return'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnReceiveModal;

