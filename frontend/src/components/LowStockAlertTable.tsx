import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LowStockAlert } from '../types/analytics';
import { AlertTriangle, ArrowUpDown, ChevronRight, PackageX, ExternalLink } from 'lucide-react';

interface LowStockAlertTableProps {
  alerts: LowStockAlert[];
  loading?: boolean;
}

export const LowStockAlertTable: React.FC<LowStockAlertTableProps> = ({
  alerts,
  loading = false,
}) => {
  const [sortField, setSortField] = useState<'deficit' | 'current_quantity'>('deficit');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: 'deficit' | 'current_quantity') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedAlerts = [...alerts].sort((a, b) => {
    const factor = sortAsc ? 1 : -1;
    return (a[sortField] - b[sortField]) * factor;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Low Stock & Depletion Warnings
            </h3>
            <p className="text-[11px] text-slate-500">
              SKUs at or below reorder threshold requiring replenishment
            </p>
          </div>
        </div>

        <Link
          to="/stock"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>Manage Stock</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3 py-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-slate-100 rounded-lg" />
          ))}
        </div>
      ) : sortedAlerts.length === 0 ? (
        <div className="py-8 text-center text-slate-400">
          <p className="text-xs font-medium text-slate-700">Healthy Inventory Levels</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            No items are currently below their reorder threshold.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Warehouse</th>
                <th
                  className="py-2.5 px-3 cursor-pointer select-none hover:text-slate-900"
                  onClick={() => handleSort('current_quantity')}
                >
                  <div className="flex items-center gap-1">
                    <span>In Stock</span>
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Threshold</th>
                <th
                  className="py-2.5 px-3 cursor-pointer select-none hover:text-slate-900"
                  onClick={() => handleSort('deficit')}
                >
                  <div className="flex items-center gap-1">
                    <span>Deficit</span>
                    <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedAlerts.map((a) => {
                const isOutOfStock = a.current_quantity === 0;

                return (
                  <tr
                    key={`${a.warehouse_id}-${a.product_id}`}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="py-2.5 px-3">
                      <div>
                        <span className="font-semibold text-slate-900 block truncate max-w-[160px]">
                          {a.product_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {a.product_sku}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                      {a.warehouse_name || `Facility #${a.warehouse_id}`}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-mono font-bold ${
                          isOutOfStock ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      >
                        {a.current_quantity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {a.reorder_threshold}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        -{a.deficit} units
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        to="/purchase-orders"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50/50 hover:bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/50"
                      >
                        Reorder
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LowStockAlertTable;

