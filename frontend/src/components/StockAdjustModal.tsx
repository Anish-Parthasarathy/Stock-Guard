import React, { useState, useEffect } from 'react';
import { adjustStockApi } from '../api/stock';
import { Stock, StockAdjustmentPayload } from '../types/inventory';
import { SlidersHorizontal, ArrowUpRight, ArrowDownRight, X, Loader2, ShieldAlert } from 'lucide-react';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: Stock | null;
  productName?: string;
  onSuccess: (msg: string) => void;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  isOpen,
  onClose,
  stock,
  productName,
  onSuccess,
}) => {
  const [adjustmentType, setAdjustmentType] = useState<'ADJUSTMENT_UP' | 'ADJUSTMENT_DOWN'>('ADJUSTMENT_UP');
  const [quantity, setQuantity] = useState<number>(1);
  const [expectedVersion, setExpectedVersion] = useState<number>(stock?.version || 1);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stock) {
      setExpectedVersion(stock.version);
      setQuantity(1);
      setNotes('');
      setError(null);
    }
  }, [stock]);

  if (!isOpen || !stock) return null;

  const currentQty = stock.quantity;
  const simulatedNewQty =
    adjustmentType === 'ADJUSTMENT_UP'
      ? currentQty + Number(quantity || 0)
      : Math.max(0, currentQty - Number(quantity || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantity <= 0) {
      setError('Quantity to adjust must be greater than 0.');
      return;
    }

    if (adjustmentType === 'ADJUSTMENT_DOWN' && quantity > currentQty) {
      setError(`Cannot deduct ${quantity} units. Current stock is only ${currentQty}.`);
      return;
    }

    setLoading(true);
    try {
      const payload: StockAdjustmentPayload = {
        warehouse_id: stock.warehouse_id,
        product_id: stock.product_id,
        adjustment_type: adjustmentType,
        quantity: Number(quantity),
        expected_version: expectedVersion ? Number(expectedVersion) : undefined,
        notes: notes.trim() || undefined,
      };

      await adjustStockApi(payload);
      onSuccess(`Stock successfully adjusted for Product #${stock.product_id}`);
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError(
          'Optimistic Concurrency Conflict (HTTP 409): This record was modified by another user concurrently. Please reload.'
        );
      } else {
        const msg = err.response?.data?.detail || err.message || 'Failed to adjust stock.';
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Adjust Inventory Stock</h3>
              <p className="text-xs text-slate-500 font-mono">
                WH #{stock.warehouse_id} · Product #{stock.product_id} {productName ? `(${productName})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs Projected Stock */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Current Count</span>
              <p className="text-lg font-bold text-slate-900 font-mono">{currentQty} units</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Projected Count</span>
              <p className="text-lg font-bold text-slate-900 font-mono">
                {simulatedNewQty} units
              </p>
            </div>
          </div>

          {/* Direction toggle */}
          <div>
            <label className="block font-medium text-slate-700 mb-1.5">Adjustment Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('ADJUSTMENT_UP')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  adjustmentType === 'ADJUSTMENT_UP'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                <span>Increment Stock (+)</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('ADJUSTMENT_DOWN')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  adjustmentType === 'ADJUSTMENT_DOWN'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                <span>Decrement Stock (-)</span>
              </button>
            </div>
          </div>

          {/* Quantity and Expected Version */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Quantity Delta</label>
              <input
                type="number"
                min={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-700">Expected Version</label>
                <span className="text-[10px] text-slate-400 font-mono">OCC</span>
              </div>
              <input
                type="number"
                min={1}
                value={expectedVersion}
                onChange={(e) => setExpectedVersion(Number(e.target.value))}
                title="Pessimistic/Optimistic row version"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>
          </div>

          {/* Notes / Reason */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Audit Reason / Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Physical inventory cycle count correction, damaged units..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Recording Adjustment...' : 'Commit Adjustment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustModal;

