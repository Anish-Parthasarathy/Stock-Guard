import React from 'react';
import { FulfillmentMetrics } from '../types/analytics';
import {
  Activity,
  CheckCircle2,
  XCircle,
  RotateCcw,
  IndianRupee,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface FulfillmentMetricsPanelProps {
  metrics: FulfillmentMetrics | null;
  loading?: boolean;
}

export const FulfillmentMetricsPanel: React.FC<FulfillmentMetricsPanelProps> = ({
  metrics,
  loading = false,
}) => {
  if (loading || !metrics) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="h-5 bg-slate-100 rounded w-1/4 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const netRevenue = metrics.total_revenue - metrics.total_refunded;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Order Fulfillment & Yield Rates
            </h3>
            <p className="text-[11px] text-slate-500">
              End-to-end customer order processing, cancellation, and returns efficiency
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-500">
          Total Processed: <span className="font-bold text-slate-900">{metrics.total_orders}</span> orders
        </span>
      </div>

      {/* Rate Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Fulfillment Rate */}
        <div className="bg-slate-50/75 border border-slate-200/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Fulfillment Rate
            </span>
            <span className="font-mono font-bold text-emerald-700 text-sm">
              {metrics.fulfillment_rate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, metrics.fulfillment_rate))}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Delivered: {metrics.delivered_orders}</span>
            <span>Target: &gt;95%</span>
          </div>
        </div>

        {/* Cancellation Rate */}
        <div className="bg-slate-50/75 border border-slate-200/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Cancellation Rate
            </span>
            <span className="font-mono font-bold text-rose-700 text-sm">
              {metrics.cancellation_rate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, metrics.cancellation_rate))}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Cancelled: {metrics.cancelled_orders}</span>
            <span>Target: &lt;5%</span>
          </div>
        </div>

        {/* Return Rate */}
        <div className="bg-slate-50/75 border border-slate-200/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
              Return Rate
            </span>
            <span className="font-mono font-bold text-indigo-700 text-sm">
              {metrics.return_rate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, metrics.return_rate))}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Returned: {metrics.returned_orders}</span>
            <span>Target: &lt;3%</span>
          </div>
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
          <span className="text-slate-600">Gross Settled Revenue:</span>
          <span className="font-mono font-bold text-emerald-800">
            {formatINR(metrics.total_revenue)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50/50 border border-rose-100">
          <span className="text-slate-600">Refund Disbursements:</span>
          <span className="font-mono font-bold text-rose-800">
            -{formatINR(metrics.total_refunded)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
          <span className="text-slate-600">Net Audited Yield:</span>
          <span className="font-mono font-bold text-indigo-900">
            {formatINR(netRevenue)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FulfillmentMetricsPanel;

