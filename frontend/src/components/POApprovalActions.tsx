import React, { useState } from 'react';
import { updatePOApprovalApi } from '../api/purchaseOrders';
import { PurchaseOrder } from '../types/procurement';
import { useAuth } from '../hooks/useAuth';
import { Check, X, FileEdit, Loader2, ShieldCheck } from 'lucide-react';

interface POApprovalActionsProps {
  po: PurchaseOrder;
  onUpdated: (updatedPO: PurchaseOrder) => void;
  showToast: (msg: string) => void;
}

export const POApprovalActions: React.FC<POApprovalActionsProps> = ({
  po,
  onUpdated,
  showToast,
}) => {
  const { isAdmin } = useAuth();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="text-[11px] text-slate-500 italic">
        Manager / Admin role required to execute PO approvals.
      </div>
    );
  }

  const isLocked = ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'].includes(po.status);

  if (isLocked) {
    return (
      <div className="text-[11px] text-slate-400">
        Approval locked in {po.status} operational state.
      </div>
    );
  }

  const handleAction = async (statusVal: 'APPROVED' | 'REJECTED' | 'AMENDMENT_REVIEW') => {
    setLoadingAction(statusVal);
    try {
      const updated = await updatePOApprovalApi(po.id, { approved_status: statusVal });
      showToast(`Purchase order marked as ${statusVal}`);
      onUpdated(updated);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to update approval status.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {po.approved_status !== 'APPROVED' && (
        <button
          onClick={() => handleAction('APPROVED')}
          disabled={!!loadingAction}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs"
        >
          {loadingAction === 'APPROVED' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          <span>Approve PO</span>
        </button>
      )}

      {po.approved_status !== 'REJECTED' && (
        <button
          onClick={() => handleAction('REJECTED')}
          disabled={!!loadingAction}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
        >
          {loadingAction === 'REJECTED' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
          <span>Reject</span>
        </button>
      )}

      {po.approved_status !== 'AMENDMENT_REVIEW' && (
        <button
          onClick={() => handleAction('AMENDMENT_REVIEW')}
          disabled={!!loadingAction}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
        >
          {loadingAction === 'AMENDMENT_REVIEW' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileEdit className="w-3.5 h-3.5" />
          )}
          <span>Request Amendment</span>
        </button>
      )}
    </div>
  );
};

export default POApprovalActions;

