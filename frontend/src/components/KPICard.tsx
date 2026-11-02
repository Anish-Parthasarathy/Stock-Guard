import React from 'react';
import { Loader2 } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    label: string;
    positive?: boolean;
  };
  color?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose';
  loading?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'slate',
  loading = false,
}) => {
  const colorMap = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorMap[color]}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        {loading ? (
          <div className="h-7 flex items-center">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          </div>
        ) : (
          <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {value}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between text-xs">
        {subtitle && <span className="text-slate-400 text-[11px]">{subtitle}</span>}
        {trend && (
          <span
            className={`font-medium text-[11px] ml-auto ${
              trend.positive ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {trend.value} {trend.label}
          </span>
        )}
      </div>
    </div>
  );
};

export default KPICard;

