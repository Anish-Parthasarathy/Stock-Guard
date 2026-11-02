import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listReturnsApi, getReturnApi } from '../api/returns';
import { listProductsApi } from '../api/products';
import { listWarehousesApi } from '../api/warehouses';
import { ReturnOrder, ReturnItem } from '../types/fulfillment';
import { Product, Warehouse } from '../types/inventory';
import { ReturnReceiveModal } from '../components/ReturnReceiveModal';
import { formatINR, formatDateIN, formatDateTimeIN } from '../utils/formatters';
import {
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  PackageCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  X,
  CreditCard,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export const ReturnsPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();

  const [returns, setReturns] = useState<ReturnOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected return for inspection / drawer
  const [selectedReturn, setSelectedReturn] = useState<ReturnOrder | null>(null);

  // Receive target modal state
  const [receiveTarget, setReceiveTarget] = useState<{
    returnOrder: ReturnOrder;
    item: ReturnItem;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [returnData, prodData, whData] = await Promise.all([
        listReturnsApi({
          status: statusFilter || undefined,
        }),
        listProductsApi(),
        listWarehousesApi(),
      ]);
      setReturns(returnData);
      setProducts(prodData);
      setWarehouses(whData);

      // Refresh drawer if open
      if (selectedReturn) {
        const updated = returnData.find((r) => r.id === selectedReturn.id);
        if (updated) setSelectedReturn(updated);
      }
    } catch {
      showToast('Failed to load return authorizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const getProductName = (id: number) => {
    return products.find((p) => p.id === id)?.name || `Product #${id}`;
  };

  const getWarehouseName = (id: number) => {
    return warehouses.find((w) => w.id === id)?.name || `Warehouse #${id}`;
  };

  const filteredReturns = returns.filter((r) => {
    if (typeFilter && r.return_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = r.id.toString().includes(q);
      const matchOrder = r.order_id?.toString().includes(q);
      const matchReason = r.reason.toLowerCase().includes(q);
      if (!matchId && !matchOrder && !matchReason) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'RESTOCKED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    }
    if (s === 'PARTIALLY_RECEIVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" />
          Partially Received
        </span>
      );
    }
    if (s === 'INITIATED' || s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Clock className="w-3 h-3" />
          Authorized
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3 h-3" />
        {status}
      </span>
    );
  };

  const getConditionBadge = (condition: string) => {
    const c = condition.toUpperCase();
    if (c === 'GOOD') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          GOOD
        </span>
      );
    }
    if (c === 'DAMAGED') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          DAMAGED
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
        DEFECTIVE
      </span>
    );
  };

  const getDispositionBadge = (disp: string) => {
    const d = disp.toUpperCase();
    if (d === 'RESTOCKED') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
          RESTOCKED
        </span>
      );
    }
    if (d === 'QUARANTINED') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          QUARANTINED
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
        SCRAPPED
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-indigo-600" />
            Customer Returns & Reverse Logistics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track authorized customer returns, inspect physical condition at the facility dock, and record restocking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Return #, Order #, or Reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-slate-400 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden text-slate-700"
          >
            <option value="">All Return Types</option>
            <option value="REFUND">REFUND</option>
            <option value="REPLACEMENT">REPLACEMENT</option>
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden text-slate-700"
        >
          <option value="">All Statuses</option>
          <option value="INITIATED">INITIATED</option>
          <option value="PARTIALLY_RECEIVED">PARTIALLY_RECEIVED</option>
          <option value="COMPLETED">COMPLETED</option>
        </select>

        {(statusFilter || typeFilter || searchQuery) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setTypeFilter('');
              setSearchQuery('');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
          >
            Clear Filters
          </button>
        )}

        <div className="ml-auto text-xs text-slate-400 font-mono">
          {filteredReturns.length} {filteredReturns.length === 1 ? 'authorization' : 'authorizations'}
        </div>
      </div>

      {/* Returns List Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
            <span className="text-xs font-mono">Loading return authorizations...</span>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-900">No return requests found</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer returns authorized from order records will appear here for dock inspection.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Return #</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Items / Expected</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Authorized At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredReturns.map((r) => {
                  const totalExpected = r.items.reduce((acc, it) => acc + it.quantity_expected, 0);
                  const totalReceived = r.receipts.reduce((acc, rc) => acc + rc.quantity_received, 0);
                  const hasPendingItems = totalReceived < totalExpected;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedReturn(r)}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        #{r.id}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {r.order_id ? `#${r.order_id}` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            r.return_type === 'REFUND'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {r.return_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-medium text-slate-900">
                            {r.items.length} {r.items.length === 1 ? 'item' : 'items'}
                          </span>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {totalReceived} / {totalExpected} units inspected
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {r.created_at ? formatDateIN(r.created_at) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {hasPendingItems && r.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                const itemToInspect = r.items[0];
                                if (itemToInspect) {
                                  setReceiveTarget({ returnOrder: r, item: itemToInspect });
                                }
                              }}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            >
                              Inspect Dock
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedReturn(r)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                            title="View details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Return Detail Drawer */}
      {selectedReturn && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 font-mono">
                    Return #{selectedReturn.id}
                  </h2>
                  {getStatusBadge(selectedReturn.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Associated Order: <span className="font-mono font-semibold text-slate-700">#{selectedReturn.order_id}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedReturn(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wider text-[11px] text-slate-500">
                  Return Specifications
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Resolution Type</span>
                    <span className="font-bold text-slate-900 block">{selectedReturn.return_type}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Creation Date</span>
                    <span className="font-mono text-slate-700 block">
                      {selectedReturn.created_at ? formatDateTimeIN(selectedReturn.created_at) : '—'}
                    </span>
                  </div>
                  {selectedReturn.financial_ledger_id && (
                    <div>
                      <span className="text-[11px] text-slate-500 block">Refund Ledger Ref</span>
                      <span className="font-mono text-rose-700 font-medium">
                        Ledger #{selectedReturn.financial_ledger_id}
                      </span>
                    </div>
                  )}
                  {selectedReturn.replacement_order_id && (
                    <div>
                      <span className="text-[11px] text-slate-500 block">Replacement Order</span>
                      <span className="font-mono text-indigo-700 font-medium">
                        Order #{selectedReturn.replacement_order_id}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500 block mb-0.5">Customer Reason</span>
                  <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 font-medium leading-relaxed">
                    {selectedReturn.reason}
                  </p>
                </div>
              </div>

              {/* Items in Return */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Authorized Items ({selectedReturn.items.length})
                </h3>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {selectedReturn.items.map((it) => {
                    const receivedForThis = selectedReturn.receipts
                      .filter((rc) => rc.return_contains_id === it.id)
                      .reduce((sum, rc) => sum + rc.quantity_received, 0);
                    const isFullyInspected = receivedForThis >= it.quantity_expected;

                    return (
                      <div key={it.id} className="p-3.5 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="font-medium text-slate-900 block">
                            {getProductName(it.product_id)}
                          </span>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Facility: {getWarehouseName(it.warehouse_id)} · Unit Price: {formatINR(it.return_unit_price)}
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono">
                            Expected: {it.quantity_expected} units · Inspected: {receivedForThis} units
                          </div>
                        </div>

                        <div>
                          {isFullyInspected ? (
                            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Inspected
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setReceiveTarget({ returnOrder: selectedReturn, item: it });
                              }}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-2xs"
                            >
                              Inspect Dock
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Receipts & Inspection Log */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Dock Inspection & Disposition Receipts ({selectedReturn.receipts.length})
                </h3>

                {selectedReturn.receipts.length === 0 ? (
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 text-center text-slate-500">
                    No physical return packages received or inspected at dock yet.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {selectedReturn.receipts.map((rc) => (
                      <div key={rc.id} className="p-3 space-y-2 bg-white">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800">
                            {getProductName(rc.product_id)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {getConditionBadge(rc.condition_status)}
                            {getDispositionBadge(rc.status)}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono">
                          Notes: {rc.condition_notes}
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center justify-between font-mono pt-1">
                          <span>Qty: {rc.quantity_received} units · Agent #{rc.received_by}</span>
                          <span>{formatDateTimeIN(rc.received_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedReturn(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors shadow-2xs"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect & Receive Item Modal */}
      {receiveTarget && (
        <ReturnReceiveModal
          isOpen={true}
          onClose={() => setReceiveTarget(null)}
          returnOrder={receiveTarget.returnOrder}
          item={receiveTarget.item}
          productName={getProductName(receiveTarget.item.product_id)}
          onSuccess={fetchData}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default ReturnsPage;

