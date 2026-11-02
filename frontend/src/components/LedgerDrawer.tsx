import React, { useState, useEffect } from 'react';
import { listStockLedgerApi } from '../api/stock';
import { StockLedger } from '../types/inventory';
import StatusBadge from './StatusBadge';
import { formatDateTimeIN } from '../utils/formatters';
import { X, RefreshCw, Loader2, History, AlertCircle } from 'lucide-react';

interface LedgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  warehouseId?: number;
  productId?: number;
  productName?: string;
}

export const LedgerDrawer: React.FC<LedgerDrawerProps> = ({
  isOpen,
  onClose,
  warehouseId,
  productId,
  productName,
}) => {
  const [ledgerEntries, setLedgerEntries] = useState<StockLedger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = async () => {
    if (!isOpen || !warehouseId || !productId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listStockLedgerApi({
        warehouse_id: warehouseId,
        product_id: productId,
      });
      // Sort newest first
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setLedgerEntries(sorted);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load stock ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLedger();
    }
  }, [isOpen, warehouseId, productId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Stock Movement Audit Ledger</h3>
              <p className="text-xs text-slate-500 font-mono">
                WH #{warehouseId} · Product #{productId} {productName ? `(${productName})` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchLedger}
              title="Refresh ledger"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
              <span className="text-xs">Querying immutable transaction log...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-xs">
              No inventory movements recorded yet for this facility item.
            </div>
          ) : (
            <div className="space-y-2">
              {ledgerEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-slate-300 transition-colors space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={entry.transaction_type} type="transaction" />
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {entry.transaction_type.includes('DOWN') || entry.transaction_type.includes('OUT')
                          ? `-${entry.change_quantity}`
                          : `+${entry.change_quantity}`}
                      </span>
                      <span className="text-slate-400 text-[11px]">units</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDateTimeIN(entry.created_at)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <div>
                      User ID: <span className="font-mono font-medium text-slate-700">#{entry.user_id}</span>
                    </div>
                    {entry.reference_type && (
                      <div>
                        Ref:{' '}
                        <span className="font-mono text-slate-700 font-medium">
                          {entry.reference_type} {entry.reference_id ? `(#${entry.reference_id})` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {entry.notes && (
                    <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-600 italic">
                      "{entry.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LedgerDrawer;

