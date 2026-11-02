import React, { useState } from 'react';
import { updatePOStatusApi } from '../api/purchaseOrders';
import { PurchaseOrder, PurchaseOrderItem, POStatus } from '../types/procurement';
import { Product } from '../types/inventory';
import POApprovalActions from './POApprovalActions';
import ReceiveItemModal from './ReceiveItemModal';
import { formatINR, formatDateIN, formatDateTimeIN } from '../utils/formatters';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Truck,
  PackageCheck,
  ChevronRight,
  Loader2,
  Receipt,
  AlertCircle,
} from 'lucide-react';

interface PODetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrder | null;
  supplierName?: string;
  allProducts: Product[];
  onRefresh: () => void;
  showToast: (msg: string) => void;
}

export const PODetailDrawer: React.FC<PODetailDrawerProps> = ({
  isOpen,
  onClose,
  po,
  supplierName,
  allProducts,
  onRefresh,
  showToast,
}) => {
  const [selectedItemForReceive, setSelectedItemForReceive] = useState<PurchaseOrderItem | null>(
    null
  );
  const [statusLoading, setStatusLoading] = useState(false);

  if (!isOpen || !po) return null;

  const totalAmount = po.items.reduce(
    (sum, item) => sum + item.quantity_ordered * Number(item.unit_price),
    0
  );

  const getProductName = (productId: number) => {
    const prod = allProducts.find((p) => p.id === productId);
    return prod ? `${prod.name} (${prod.sku})` : `Product #${productId}`;
  };

  const handleStatusChange = async (nextStatus: 'ISSUED_TO_VENDOR' | 'IN_TRANSIT' | 'CLOSED') => {
    setStatusLoading(true);
    try {
      await updatePOStatusApi(po.id, { status: nextStatus });
      showToast(`Purchase order status updated to ${nextStatus}`);
      onRefresh();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to update transit status.');
    } finally {
      setStatusLoading(false);
    }
  };

  // Determine stage progression for stepper
  const getStepIndex = () => {
    if (po.status === 'FULLY_RECEIVED' || po.status === 'CLOSED') return 5;
    if (po.status === 'PARTIALLY_RECEIVED') return 4;
    if (po.status === 'IN_TRANSIT') return 3;
    if (po.status === 'ISSUED_TO_VENDOR') return 2;
    if (po.approved_status === 'APPROVED') return 1;
    return 0; // Draft or Pending
  };

  const steps = ['Pending Approval', 'Approved', 'Issued to Vendor', 'In Transit', 'Receiving', 'Completed'];
  const activeStep = getStepIndex();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Purchase Order #{po.id}</h3>
                <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                  {po.status}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
                  po.approved_status === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : po.approved_status === 'REJECTED'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {po.approved_status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                Vendor: {supplierName || `Supplier #${po.supplier_id}`} · Created {formatDateIN(po.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Status Stepper */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-3">
              Procurement Lifecycle
            </span>
            <div className="flex items-center justify-between text-[11px]">
              {steps.map((label, idx) => (
                <div key={label} className="flex-1 flex flex-col items-center relative text-center">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs mb-1 transition-colors ${
                      idx < activeStep
                        ? 'bg-slate-900 text-white'
                        : idx === activeStep
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {idx < activeStep ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`text-[10px] leading-tight ${
                      idx <= activeStep ? 'text-slate-900 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow Action Bar */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              Workflow Controls
            </span>

            {/* Approval Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <span className="text-slate-700 font-medium">Approval Review:</span>
              <POApprovalActions
                po={po}
                onUpdated={() => onRefresh()}
                showToast={showToast}
              />
            </div>

            {/* Transit Controls (Only if approved) */}
            {po.approved_status === 'APPROVED' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <span className="text-slate-700 font-medium">Fulfillment State:</span>
                <div className="flex items-center gap-2">
                  {po.status === 'NOT_ISSUED' && (
                    <button
                      onClick={() => handleStatusChange('ISSUED_TO_VENDOR')}
                      disabled={statusLoading}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
                    >
                      Issue to Vendor
                    </button>
                  )}
                  {po.status === 'ISSUED_TO_VENDOR' && (
                    <button
                      onClick={() => handleStatusChange('IN_TRANSIT')}
                      disabled={statusLoading}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
                    >
                      Mark In-Transit
                    </button>
                  )}
                  {['PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(po.status) && (
                    <button
                      onClick={() => handleStatusChange('CLOSED')}
                      disabled={statusLoading}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
                    >
                      Close PO
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Purchased Line Items ({po.items.length})
              </span>
              <span className="font-mono text-xs font-bold text-slate-900">
                Total: {formatINR(totalAmount)}
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Product SKU</th>
                    <th className="px-4 py-2.5">Facility</th>
                    <th className="px-4 py-2.5">Ordered</th>
                    <th className="px-4 py-2.5">Received</th>
                    <th className="px-4 py-2.5">Unit Cost</th>
                    <th className="px-4 py-2.5">Line Total</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {po.items.map((it) => {
                    const receivedQty = po.receipts
                      .filter((r) => r.purchase_order_contains_id === it.id)
                      .reduce((sum, r) => sum + r.quantity_received, 0);

                    const canReceive =
                      po.approved_status === 'APPROVED' &&
                      ['ISSUED_TO_VENDOR', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(po.status) &&
                      receivedQty < it.quantity_ordered;

                    return (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {getProductName(it.product_id)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">WH #{it.warehouse_id}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {it.quantity_ordered}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                          {receivedQty}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {formatINR(it.unit_price)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {formatINR(it.quantity_ordered * Number(it.unit_price))}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canReceive ? (
                            <button
                              onClick={() => setSelectedItemForReceive(it)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium transition-colors"
                            >
                              Receive
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {receivedQty >= it.quantity_ordered ? 'Complete' : 'Locked'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Receiving Receipts Log */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-slate-600" />
              <span>Receiving Receipts Log ({po.receipts.length})</span>
            </span>

            {po.receipts.length === 0 ? (
              <p className="text-slate-400 text-[11px] italic">
                No items have been received against this purchase order yet.
              </p>
            ) : (
              <div className="space-y-2">
                {po.receipts.map((rc) => (
                  <div
                    key={rc.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-900">
                        {getProductName(rc.product_id)}: +{rc.quantity_received} units received
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {formatDateTimeIN(rc.received_at)}
                      </span>
                    </div>
                    {rc.condition_notes && (
                      <p className="text-slate-600 text-[11px] italic">"{rc.condition_notes}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Receive Item Modal */}
      {selectedItemForReceive && (
        <ReceiveItemModal
          isOpen={!!selectedItemForReceive}
          onClose={() => setSelectedItemForReceive(null)}
          po={po}
          item={selectedItemForReceive}
          productName={getProductName(selectedItemForReceive.product_id)}
          onSuccess={() => onRefresh()}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default PODetailDrawer;

