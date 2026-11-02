import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listOrdersApi, releaseOrderReservationApi } from '../api/orders';
import { listProductsApi } from '../api/products';
import { listWarehousesApi } from '../api/warehouses';
import { Order } from '../types/fulfillment';
import { Product, Warehouse } from '../types/inventory';
import OrderStatusStepper from '../components/OrderStatusStepper';
import PaymentConfirmModal from '../components/PaymentConfirmModal';
import CancelOrderModal from '../components/CancelOrderModal';
import ScheduleDeliveryModal from '../components/ScheduleDeliveryModal';
import CreateReturnModal from '../components/CreateReturnModal';
import { formatINR, formatDateTimeIN } from '../utils/formatters';
import {
  Layers,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  X,
  CreditCard,
  Truck,
  RotateCcw,
  Ban,
  Clock,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

export const OrdersPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();

  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('');
  const [searchRef, setSearchRef] = useState('');

  // Selected order for full detail drawer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Modals state
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [orderData, prodData, whData] = await Promise.all([
        listOrdersApi({
          warehouse_id: warehouseFilter ? Number(warehouseFilter) : undefined,
          order_status: orderStatusFilter || undefined,
          payment_status: paymentStatusFilter || undefined,
        }),
        listProductsApi().catch(() => []),
        listWarehousesApi().catch(() => []),
      ]);
      setOrders(orderData);
      setProducts(prodData);
      setWarehouses(whData);

      // Keep detail drawer sync if open
      if (selectedOrder) {
        const refreshed = orderData.find((o) => o.id === selectedOrder.id);
        if (refreshed) setSelectedOrder(refreshed);
      }
    } catch {
      showToast('Failed to load incoming orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [warehouseFilter, orderStatusFilter, paymentStatusFilter]);

  const handleReleaseReservation = async (orderId: number) => {
    if (!window.confirm(`Release held stock reservations for Order #${orderId}?`)) return;
    setActionLoading(true);
    try {
      await releaseOrderReservationApi(orderId);
      showToast(`Stock reservations released for Order #${orderId}`);
      fetchOrders();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to release reservations.');
    } finally {
      setActionLoading(false);
    }
  };

  const getProductName = (productId: number) => {
    return products.find((p) => p.id === productId)?.name || `Product #${productId}`;
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchRef) return true;
    const q = searchRef.toLowerCase();
    return (
      o.external_reference_id.toLowerCase().includes(q) ||
      String(o.id).includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inbound Order Monitoring</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal operations view for orders originating from external e-commerce sites.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Ext Ref or ID..."
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
            />
          </div>

          {/* Facility filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Facility:</span>
          </div>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value ? Number(e.target.value) : '')}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Facilities</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name || `Facility #${wh.id}`}
              </option>
            ))}
          </select>

          {/* Order status filter */}
          <select
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Order Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {/* Payment status filter */}
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Payment States</option>
            <option value="PENDING">UNPAID (PENDING)</option>
            <option value="PAID">PAID</option>
          </select>
        </div>

        <button
          onClick={fetchOrders}
          title="Refresh List"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Order ID</th>
                <th className="px-5 py-3">External Ref</th>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Total Value (₹)</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3">Fulfillment</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      <span>Loading incoming orders...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No inbound orders found. Use the API Simulator drawer to inject test webhooks.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isPaid = ord.payment_status.toUpperCase() === 'PAID';
                  const isCancelled = ord.order_status.toUpperCase() === 'CANCELLED';

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className={`cursor-pointer transition-colors ${
                        isCancelled
                          ? 'bg-rose-50/20 text-slate-400'
                          : 'hover:bg-slate-50/75'
                      }`}
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        #{ord.id}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-slate-700">
                        <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                          {ord.external_reference_id}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-500">
                        WH #{ord.warehouse_id}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400 text-[11px]">
                        {formatDateTimeIN(ord.created_at)}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900 text-sm">
                        {formatINR(ord.total_amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {ord.payment_status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
                            isCancelled
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          {ord.order_status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                        {!isPaid && !isCancelled && (
                          <button
                            onClick={() => setPaymentOrder(ord)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs font-medium transition-colors shadow-2xs"
                          >
                            <CreditCard className="w-3 h-3 text-slate-500" />
                            <span>Settle</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs transition-colors shadow-2xs"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Slide-Over Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Order #{selectedOrder.id}</h3>
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                      {selectedOrder.external_reference_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Facility #{selectedOrder.warehouse_id} · Inbound Timestamp:{' '}
                    {formatDateTimeIN(selectedOrder.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Stepper */}
              <OrderStatusStepper
                orderStatus={selectedOrder.order_status}
                paymentStatus={selectedOrder.payment_status}
              />

              {/* Action Toolbar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Staff Fulfillment Actions
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedOrder.payment_status !== 'PAID' &&
                    selectedOrder.order_status !== 'CANCELLED' && (
                      <button
                        onClick={() => setPaymentOrder(selectedOrder)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Settle Payment ({formatINR(selectedOrder.total_amount)})</span>
                      </button>
                    )}

                  {selectedOrder.payment_status === 'PAID' &&
                    selectedOrder.order_status !== 'CANCELLED' && (
                      <>
                        <button
                          onClick={() => setDeliveryOrder(selectedOrder)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Schedule Delivery Dispatch</span>
                        </button>
                        <button
                          onClick={() => setReturnOrder(selectedOrder)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg font-medium transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                          <span>Authorize Return</span>
                        </button>
                      </>
                    )}

                  {selectedOrder.payment_status !== 'PAID' &&
                    selectedOrder.order_status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleReleaseReservation(selectedOrder.id)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-medium transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Release Reservation Holds</span>
                      </button>
                    )}

                  {selectedOrder.order_status !== 'CANCELLED' && (
                    <button
                      onClick={() => setCancelOrder(selectedOrder)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-medium transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Cancel Order</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Purchased Items ({selectedOrder.items.length})</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    Total: {formatINR(selectedOrder.total_amount)}
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] font-semibold text-slate-500 border-b border-slate-200 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Product</th>
                        <th className="px-4 py-2.5">Quantity</th>
                        <th className="px-4 py-2.5">Unit Price (₹)</th>
                        <th className="px-4 py-2.5 text-right">Subtotal (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((it) => (
                        <tr key={it.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {getProductName(it.product_id)}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {it.quantity}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {formatINR(it.unit_price)}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 text-right">
                            {formatINR(it.quantity * Number(it.unit_price))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Stock Reservations */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>DBMS Concurrency Stock Reservations ({selectedOrder.reservations.length})</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  Pessimistic stock holds prevent overselling across concurrent transactions.
                </p>

                {selectedOrder.reservations.length === 0 ? (
                  <p className="text-slate-400 text-[11px] italic">
                    No active reservation holds (order settled or cancelled).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedOrder.reservations.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs font-mono"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {getProductName(r.product_id)}: {r.quantity} units held
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Expires at: {new Date(r.expire_at).toLocaleTimeString()}
                          </div>
                        </div>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Settlement Modal */}
      {paymentOrder && (
        <PaymentConfirmModal
          isOpen={!!paymentOrder}
          onClose={() => setPaymentOrder(null)}
          order={paymentOrder}
          onSuccess={fetchOrders}
          showToast={showToast}
        />
      )}

      {/* Cancellation Modal */}
      {cancelOrder && (
        <CancelOrderModal
          isOpen={!!cancelOrder}
          onClose={() => setCancelOrder(null)}
          order={cancelOrder}
          onSuccess={fetchOrders}
          showToast={showToast}
        />
      )}

      {/* Delivery Schedule Modal */}
      {deliveryOrder && (
        <ScheduleDeliveryModal
          isOpen={!!deliveryOrder}
          onClose={() => setDeliveryOrder(null)}
          order={deliveryOrder}
          onSuccess={fetchOrders}
          showToast={showToast}
        />
      )}

      {/* Create Return Modal */}
      {returnOrder && (
        <CreateReturnModal
          isOpen={!!returnOrder}
          onClose={() => setReturnOrder(null)}
          order={returnOrder}
          allProducts={products}
          onSuccess={fetchOrders}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default OrdersPage;

