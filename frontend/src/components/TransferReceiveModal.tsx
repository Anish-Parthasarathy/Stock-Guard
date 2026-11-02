import React, { useState } from 'react';
import { receiveTransferItemApi } from '../api/transfers';
import { Transfer, TransferItem } from '../types/fulfillment';
import { PackageCheck, X, Loader2 } from 'lucide-react';

interface TransferReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: Transfer;
  item: TransferItem | null;
  productName?: string;
  onSuccess: () => void;
  showToast: (msg: string) => void;
}

export const TransferReceiveModal: React.FC<TransferReceiveModalProps> = ({
  isOpen,
  onClose,
  transfer,
  item,
  productName,
  onSuccess,
  showToast,
}) => {
  const [quantity, setQuantity] = useState<number>(item?.quantity_dispatched || 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await receiveTransferItemApi(transfer.id, {
        transfer_contains_id: item.id,
        quantity_received: Number(quantity),
        status: 'RECEIVED',
      });
      showToast(`Transfer item received! Stock credited to destination facility.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to receive transfer item.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Receive Transfer Item</h3>
              <p className="text-xs text-slate-500 font-mono">Transfer #{transfer.id}</p>
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

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-900 block">
              {productName || `Product #${item.product_id}`}
            </span>
            <div className="text-[11px] text-slate-500 font-mono">
              Dispatched Quantity: <span className="font-bold text-slate-800">{item.quantity_dispatched} units</span>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Quantity Received</label>
            <input
              type="number"
              min={1}
              max={item.quantity_dispatched}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono"
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
              <span>{submitting ? 'Receiving...' : 'Confirm Receipt'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferReceiveModal;

