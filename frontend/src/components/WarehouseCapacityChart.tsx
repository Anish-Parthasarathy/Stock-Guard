import React from 'react';
import { WarehouseCapacityMetric } from '../types/analytics';
import { Building2, AlertTriangle, CheckCircle2, AlertOctagon } from 'lucide-react';

interface WarehouseCapacityChartProps {
  metrics: WarehouseCapacityMetric[];
  loading?: boolean;
}

export const WarehouseCapacityChart: React.FC<WarehouseCapacityChartProps> = ({
  metrics,
  loading = false,
}) => {
  const getUtilizationColor = (rate: number) => {
    if (rate >= 90) {
      return {
        bar: 'bg-rose-500',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <AlertOctagon className="w-3 h-3 text-rose-600" />,
        label: 'Critical',
      };
    }
    if (rate >= 70) {
      return {
        bar: 'bg-amber-500',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <AlertTriangle className="w-3 h-3 text-amber-600" />,
        label: 'Elevated',
      };
    }
    return {
      bar: 'bg-emerald-500',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
      label: 'Optimal',
    };
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Warehouse Capacity Utilization
            </h3>
            <p className="text-[11px] text-slate-500">
              Live volumetric storage load across operational facilities
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            &lt; 70% Optimal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            70–90% Warning
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            &gt; 90% Near Limit
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 py-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded-full w-full" />
            </div>
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs font-mono">
          No warehouse capacity metrics recorded.
        </div>
      ) : (
        <div className="space-y-5">
          {metrics.map((m) => {
            const status = getUtilizationColor(m.utilization_rate);
            const clampedRate = Math.min(Math.max(m.utilization_rate, 0), 100);

            return (
              <div key={m.warehouse_id} className="space-y-1.5 group">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {m.warehouse_name || `Facility #${m.warehouse_id}`}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      ({m.location})
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${status.badge}`}
                    >
                      {status.icon}
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-500">
                      {m.current_stock_quantity.toLocaleString('en-IN')} / {m.capacity.toLocaleString('en-IN')} units
                    </span>
                    <span className="font-bold text-slate-900">
                      {m.utilization_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${status.bar}`}
                    style={{ width: `${clampedRate}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-0.5">
                  <span>Distinct SKUs stored: {m.distinct_products}</span>
                  <span>Available headroom: {Math.max(0, m.capacity - m.current_stock_quantity).toLocaleString('en-IN')} units</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WarehouseCapacityChart;

