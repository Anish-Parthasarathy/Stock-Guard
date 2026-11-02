import React, { useState, useEffect } from 'react';
import { DeadStockItem } from '../types/analytics';
import { Archive, Clock, IndianRupee, Loader2 } from 'lucide-react';
import { formatINR, formatDateIN } from '../utils/formatters';

interface DeadStockTableProps {
  days: number;
  onDaysChange: (newDays: number) => void;
  items: DeadStockItem[];
  loading?: boolean;
}

export const DeadStockTable: React.FC<DeadStockTableProps> = ({
  days,
  onDaysChange,
  items,
  loading = false,
}) => {
  const [localDays, setLocalDays] = useState(days);

  // Debounce input changes by 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localDays !== days && localDays >= 1) {
        onDaysChange(localDays);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localDays, days, onDaysChange]);

  const totalCapitalTied = items.reduce((sum, it) => sum + Number(it.total_tied_capital), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Archive className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Dead Stock & Idle Inventory
            </h3>
            <p className="text-[11px] text-slate-500">
              SKUs with zero stock ledger movement over specified idle window
            </p>
          </div>
        </div>

        {/* Days Threshold Input & Tied Capital Summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-600 font-medium">Inactive Days:</span>
            <input
              type="number"
              min={1}
              max={365}
              value={localDays}
              onChange={(e) => setLocalDays(Math.max(1, Number(e.target.value)))}
              className="w-14 py-0.5 px-1.5 text-xs font-mono font-bold text-slate-900 border border-slate-300 rounded bg-white text-center focus:outline-hidden focus:border-slate-500"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono font-bold">
            <IndianRupee className="w-3.5 h-3.5" />
            {formatINR(totalCapitalTied)} tied
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          <span className="text-xs font-mono">Analyzing inventory ledger activity...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <p className="text-xs font-medium text-slate-700">No Inactive Inventory</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            All stored SKUs have registered stock ledger movements within the last {days} days.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Warehouse</th>
                <th className="py-2.5 px-3">Idle Quantity</th>
                <th className="py-2.5 px-3">Unit Price</th>
                <th className="py-2.5 px-3">Tied Capital</th>
                <th className="py-2.5 px-3">Last Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {items.map((it) => (
                <tr
                  key={`${it.warehouse_id}-${it.product_id}`}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <div>
                      <span className="font-semibold text-slate-900 block truncate max-w-[170px]">
                        {it.product_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {it.product_sku}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-medium">
                    {it.warehouse_name || `Facility #${it.warehouse_id}`}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                    {it.quantity} units
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {formatINR(it.unit_price)}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-rose-700">
                    {formatINR(it.total_tied_capital)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                    {it.last_movement_at ? formatDateIN(it.last_movement_at) : 'Never'}
                    {it.days_inactive != null && (
                      <span className="text-slate-400 block text-[10px]">
                        ({it.days_inactive} days ago)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DeadStockTable;

