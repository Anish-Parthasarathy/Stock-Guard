import React from 'react';
import { Link } from 'react-router-dom';
import { SupplierPerformanceMetric } from '../types/analytics';
import { Truck, CheckCircle2, ExternalLink } from 'lucide-react';

interface SupplierPerformanceChartProps {
  metrics: SupplierPerformanceMetric[];
  loading?: boolean;
}

export const SupplierPerformanceChart: React.FC<SupplierPerformanceChartProps> = ({
  metrics,
  loading = false,
}) => {
  const getRatingBadge = (rate: number) => {
    if (rate >= 90) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Reliable
        </span>
      );
    }
    if (rate >= 75) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          Average
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        Review Required
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Supplier Procurement Reliability
            </h3>
            <p className="text-[11px] text-slate-500">
              Procurement order completion and unit fulfillment ratio by vendor
            </p>
          </div>
        </div>

        <Link
          to="/suppliers"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          <span>Suppliers</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4 py-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg" />
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs font-mono">
          No procurement vendor metrics available.
        </div>
      ) : (
        <div className="space-y-4">
          {metrics.map((s) => {
            const clampedRate = Math.min(100, Math.max(0, s.fulfillment_rate));

            return (
              <div
                key={s.supplier_id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-xs">
                      {s.supplier_name}
                    </span>
                    {getRatingBadge(s.fulfillment_rate)}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-500 text-[11px]">Fulfillment Rate:</span>
                    <span className="font-bold text-slate-900">
                      {s.fulfillment_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar comparison: received vs ordered */}
                <div className="space-y-1">
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${clampedRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>
                      Received: <strong className="text-slate-800">{s.total_units_received.toLocaleString('en-IN')}</strong> / {s.total_units_ordered.toLocaleString('en-IN')} units
                    </span>
                    <span>
                      POs: <strong className="text-slate-800">{s.completed_purchase_orders}</strong> / {s.total_purchase_orders} completed
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SupplierPerformanceChart;

