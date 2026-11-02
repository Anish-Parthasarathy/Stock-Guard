import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'stock' | 'transaction' | 'reference' | 'default';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'default' }) => {
  const normalized = status.toUpperCase();

  if (type === 'stock') {
    if (normalized === 'OUT_OF_STOCK' || normalized === 'CRITICAL') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-mono font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          OUT OF STOCK
        </span>
      );
    }
    if (normalized === 'LOW' || normalized === 'LOW_STOCK') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-mono font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          LOW STOCK
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        OPTIMAL
      </span>
    );
  }

  if (type === 'transaction') {
    switch (normalized) {
      case 'STOCK_IN':
        return (
          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-semibold">
            + STOCK IN
          </span>
        );
      case 'STOCK_OUT':
        return (
          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-mono font-semibold">
            - STOCK OUT
          </span>
        );
      case 'ADJUSTMENT_UP':
        return (
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono font-semibold">
            ▲ ADJUST UP
          </span>
        );
      case 'ADJUSTMENT_DOWN':
        return (
          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-mono font-semibold">
            ▼ ADJUST DOWN
          </span>
        );
      default:
        return (
          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
            {status}
          </span>
        );
    }
  }

  return (
    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
      {status}
    </span>
  );
};

export default StatusBadge;

