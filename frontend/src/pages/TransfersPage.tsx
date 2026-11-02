import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listTransfersApi, getTransferApi } from '../api/transfers';
import { listWarehousesApi } from '../api/warehouses';
import { listProductsApi } from '../api/products';
import { Transfer, TransferItem } from '../types/fulfillment';
import { Warehouse, Product } from '../types/inventory';
import { DispatchTransferModal } from '../components/DispatchTransferModal';
import { TransferReceiveModal } from '../components/TransferReceiveModal';
import { formatDateIN, formatDateTimeIN } from '../utils/formatters';
import {
  ArrowRightLeft,
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Loader2,
  PackageCheck,
  Truck,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  X,
  Calendar,
  Layers,
} from 'lucide-react';

export const TransfersPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [viewTab, setViewTab] = useState<'ALL' | 'OUTBOUND' | 'INBOUND'>('ALL');
  const [selectedFacility, setSelectedFacility] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchId, setSearchId] = useState<string>('');

  // Selected transfer for detailed drawer
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  // Modals
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<{
    transfer: Transfer;
    item: TransferItem;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [transfersData, whData, prodData] = await Promise.all([
        listTransfersApi(),
        listWarehousesApi(),
        listProductsApi(),
      ]);
      setTransfers(transfersData);
      setWarehouses(whData);
      setProducts(prodData);

      // Refresh currently selected transfer if drawer is open
      if (selectedTransfer) {
        const updated = transfersData.find((t) => t.id === selectedTransfer.id);
        if (updated) setSelectedTransfer(updated);
      }
    } catch {
      showToast('Failed to load transfers data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getWarehouseName = (id: number) => {
    return warehouses.find((w) => w.id === id)?.name || `Facility #${id}`;
  };

  const getProductName = (id: number) => {
    return products.find((p) => p.id === id)?.name || `Product #${id}`;
  };

  // Filter transfers based on active tab & filters
  const filteredTransfers = transfers.filter((t) => {
    if (selectedFacility) {
      if (viewTab === 'OUTBOUND' && t.source_warehouse_id !== Number(selectedFacility)) return false;
      if (viewTab === 'INBOUND' && t.destination_warehouse_id !== Number(selectedFacility)) return false;
      if (viewTab === 'ALL' && t.source_warehouse_id !== Number(selectedFacility) && t.destination_warehouse_id !== Number(selectedFacility)) {
        return false;
      }
    } else {
      if (viewTab === 'OUTBOUND' && !t.source_warehouse_id) return false;
      if (viewTab === 'INBOUND' && !t.destination_warehouse_id) return false;
    }

    if (statusFilter && t.status !== statusFilter) return false;
    if (searchId && !t.id.toString().includes(searchId.trim())) return false;

    return true;
  });

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'DELIVERED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>
      );
    }
    if (s === 'DISPATCHED' || s === 'IN_TRANSIT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Truck className="w-3 h-3" />
          In Transit
        </span>
      );
    }
    if (s === 'CANCELLED' || s === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3" />
          Cancelled
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            Stock Transfers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch inventory between facilities and verify destination arrivals to rebalance stock.
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
          <button
            onClick={() => setIsDispatchModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Dispatch Transfer
          </button>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-3">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewTab('ALL')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewTab === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All Transfers
            </button>
            <button
              onClick={() => setViewTab('OUTBOUND')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewTab === 'OUTBOUND'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Outbound Dispatches
            </button>
            <button
              onClick={() => setViewTab('INBOUND')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewTab === 'INBOUND'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Inbound Receipts
            </button>
          </div>

          <span className="text-xs text-slate-400 font-mono">
            {filteredTransfers.length} {filteredTransfers.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Transfer ID..."
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-slate-400 font-mono transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value ? Number(e.target.value) : '')}
              className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden text-slate-700"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.location})
                </option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="DISPATCHED">DISPATCHED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {(selectedFacility || statusFilter || searchId) && (
            <button
              onClick={() => {
                setSelectedFacility('');
                setStatusFilter('');
                setSearchId('');
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
            <span className="text-xs font-mono">Loading transfers...</span>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowRightLeft className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-900">No transfers found</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjust filters or dispatch an intra-facility stock transfer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-4">Route (Origin → Destination)</th>
                  <th className="py-3 px-4">Transport</th>
                  <th className="py-3 px-4">Items / Qty</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Dispatched At</th>
                  <th className="py-3 px-4">Expected Arrival</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransfers.map((t) => {
                  const totalDispatched = t.items.reduce((acc, it) => acc + it.quantity_dispatched, 0);
                  const totalReceived = t.receipts.reduce((acc, r) => acc + r.quantity_received, 0);
                  const isPendingReceipt = totalReceived < totalDispatched;

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedTransfer(t)}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        #{t.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <span className="truncate max-w-[130px]" title={getWarehouseName(t.source_warehouse_id)}>
                            {getWarehouseName(t.source_warehouse_id)}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[130px] text-indigo-700" title={getWarehouseName(t.destination_warehouse_id)}>
                            {getWarehouseName(t.destination_warehouse_id)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Truck className="w-3 h-3 text-slate-400" />
                          {t.transport_mode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-medium text-slate-900">
                            {t.items.length} {t.items.length === 1 ? 'item' : 'items'}
                          </span>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {totalReceived} / {totalDispatched} units
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(t.status)}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {t.dispatched_at ? formatDateIN(t.dispatched_at) : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {t.expected_completion ? formatDateIN(t.expected_completion) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isPendingReceipt && t.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                // Select first item with pending units
                                const itemToReceive = t.items[0];
                                if (itemToReceive) {
                                  setReceiveTarget({ transfer: t, item: itemToReceive });
                                }
                              }}
                              className="px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            >
                              Receive Item
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedTransfer(t)}
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

      {/* Transfer Detail Drawer */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-slate-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 font-mono">
                    Transfer #{selectedTransfer.id}
                  </h2>
                  {getStatusBadge(selectedTransfer.status)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Initiated by User #{selectedTransfer.initiated_by}
                </p>
              </div>
              <button
                onClick={() => setSelectedTransfer(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Route Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="font-semibold text-slate-900 block text-xs uppercase tracking-wider text-[11px] text-slate-500">
                  Transfer Route & Logistics
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Origin Facility</span>
                    <span className="font-medium text-slate-900 block truncate">
                      {getWarehouseName(selectedTransfer.source_warehouse_id)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Destination Facility</span>
                    <span className="font-medium text-indigo-700 block truncate">
                      {getWarehouseName(selectedTransfer.destination_warehouse_id)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Transport Mode</span>
                    <span className="font-medium text-slate-800 uppercase">
                      {selectedTransfer.transport_mode}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Expected Arrival</span>
                    <span className="font-mono text-slate-700">
                      {selectedTransfer.expected_completion
                        ? formatDateTimeIN(selectedTransfer.expected_completion)
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items in Transfer */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Dispatched Items ({selectedTransfer.items.length})
                  </h3>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {selectedTransfer.items.map((it) => {
                    const receivedForThis = selectedTransfer.receipts
                      .filter((r) => r.transfer_contains_id === it.id)
                      .reduce((sum, r) => sum + r.quantity_received, 0);
                    const isFullyReceived = receivedForThis >= it.quantity_dispatched;

                    return (
                      <div key={it.id} className="p-3.5 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="font-medium text-slate-900 block">
                            {getProductName(it.product_id)}
                          </span>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Dispatched: {it.quantity_dispatched} units · Received: {receivedForThis} units
                          </div>
                        </div>

                        <div>
                          {isFullyReceived ? (
                            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              Received
                            </span>
                          ) : selectedTransfer.status !== 'CANCELLED' ? (
                            <button
                              onClick={() => {
                                setReceiveTarget({ transfer: selectedTransfer, item: it });
                              }}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                            >
                              Receive Units
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Cancelled</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Receipts History */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Receipt Log ({selectedTransfer.receipts.length})
                </h3>

                {selectedTransfer.receipts.length === 0 ? (
                  <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 text-center text-slate-500">
                    No physical receipts logged yet at destination.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                    {selectedTransfer.receipts.map((rc) => (
                      <div key={rc.id} className="p-3 space-y-1 bg-white">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800">
                            {getProductName(rc.product_id)}
                          </span>
                          <span className="font-mono font-bold text-emerald-700">
                            +{rc.quantity_received} units
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center justify-between font-mono">
                          <span>Received by Agent #{rc.received_by}</span>
                          <span>{formatDateTimeIN(rc.arrived_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors shadow-2xs"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Transfer Modal */}
      <DispatchTransferModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        warehouses={warehouses}
        products={products}
        onSuccess={fetchData}
        showToast={showToast}
      />

      {/* Receive Transfer Item Modal */}
      {receiveTarget && (
        <TransferReceiveModal
          isOpen={true}
          onClose={() => setReceiveTarget(null)}
          transfer={receiveTarget.transfer}
          item={receiveTarget.item}
          productName={getProductName(receiveTarget.item.product_id)}
          onSuccess={fetchData}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default TransfersPage;
