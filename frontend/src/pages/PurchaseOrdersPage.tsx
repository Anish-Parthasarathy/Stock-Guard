import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listPurchaseOrdersApi, createPurchaseOrderApi } from '../api/purchaseOrders';
import { listSuppliersApi, listSupplierProductsApi } from '../api/suppliers';
import { listProductsApi } from '../api/products';
import { listWarehousesApi } from '../api/warehouses';
import {
  PurchaseOrder,
  PurchaseOrderCreatePayload,
  PurchaseOrderItemCreatePayload,
  Supplier,
  SupplierProduct,
} from '../types/procurement';
import { Product, Warehouse } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import PODetailDrawer from '../components/PODetailDrawer';
import { formatINR, formatDateIN } from '../utils/formatters';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  X,
  Trash2,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';

export const PurchaseOrdersPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();
  const { isAdmin } = useAuth();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Drawer
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Create PO Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSupplierId, setCreateSupplierId] = useState<number>(1);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [poItems, setPoItems] = useState<PurchaseOrderItemCreatePayload[]>([
    {
      product_id: 1,
      warehouse_id: 1,
      quantity_ordered: 50,
      unit_price: 15.0,
      expected_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pos, sups, prods, whs] = await Promise.all([
        listPurchaseOrdersApi({
          supplier_id: selectedSupplierId ? Number(selectedSupplierId) : undefined,
          status: selectedStatus || undefined,
          approved_status: selectedApprovalStatus || undefined,
        }),
        listSuppliersApi().catch(() => []),
        listProductsApi().catch(() => []),
        listWarehousesApi().catch(() => []),
      ]);
      setPurchaseOrders(pos);
      setSuppliers(sups);
      setProducts(prods);
      setWarehouses(whs);

      // Keep drawer in sync if open
      if (selectedPO) {
        const refreshed = pos.find((p) => p.id === selectedPO.id);
        if (refreshed) setSelectedPO(refreshed);
      }
    } catch {
      showToast('Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSupplierId, selectedApprovalStatus, selectedStatus]);

  // When supplier changes in create modal, fetch their contracted product catalogue
  useEffect(() => {
    if (showCreateModal && createSupplierId) {
      listSupplierProductsApi(createSupplierId)
        .then((sp) => setSupplierProducts(sp))
        .catch(() => setSupplierProducts([]));
    }
  }, [createSupplierId, showCreateModal]);

  const handleAddItemRow = () => {
    setPoItems((prev) => [
      ...prev,
      {
        product_id: products[0]?.id || 1,
        warehouse_id: warehouses[0]?.id || 1,
        quantity_ordered: 25,
        unit_price: 10.0,
        expected_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseOrderItemCreatePayload, val: any) => {
    setPoItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };

      // If product changed and matches a supplier product, auto-fill unit_price
      if (field === 'product_id') {
        const sp = supplierProducts.find((p) => p.product_id === Number(val));
        if (sp) {
          copy[index].unit_price = sp.unit_price;
        }
      }
      return copy;
    });
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (poItems.length === 0) {
      setFormError('Please add at least one line item.');
      return;
    }

    // Check for duplicate product IDs
    const prodIds = poItems.map((it) => it.product_id);
    if (new Set(prodIds).size !== prodIds.length) {
      setFormError('Duplicate product found in line items. Combine quantities into a single row.');
      return;
    }

    for (const item of poItems) {
      if (item.quantity_ordered <= 0) {
        setFormError('All quantities must be greater than 0.');
        return;
      }
      if (item.unit_price <= 0) {
        setFormError('Unit prices must be greater than 0.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: PurchaseOrderCreatePayload = {
        supplier_id: Number(createSupplierId),
        is_auto_generated: false,
        items: poItems.map((it) => ({
          product_id: Number(it.product_id),
          warehouse_id: Number(it.warehouse_id),
          quantity_ordered: Number(it.quantity_ordered),
          unit_price: Number(it.unit_price),
          expected_date: new Date(it.expected_date).toISOString(),
        })),
      };

      const newPO = await createPurchaseOrderApi(payload);
      showToast(`Purchase Order #${newPO.id} created!`);
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create purchase order.';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const getSupplierName = (id: number) => {
    return suppliers.find((s) => s.id === id)?.name || `Supplier #${id}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Restocking procurement, approval review workflows, and warehouse goods receiving.
          </p>
        </div>
        <button
          onClick={() => {
            if (suppliers.length > 0) setCreateSupplierId(suppliers[0].id);
            setPoItems([
              {
                product_id: products[0]?.id || 1,
                warehouse_id: warehouses[0]?.id || 1,
                quantity_ordered: 50,
                unit_price: 15.0,
                expected_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
              },
            ]);
            setFormError(null);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-3 items-center justify-between shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Supplier filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Supplier:</span>
          </div>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : '')}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Approval filter */}
          <select
            value={selectedApprovalStatus}
            onChange={(e) => setSelectedApprovalStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Approvals</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="AMENDMENT_REVIEW">AMENDMENT_REVIEW</option>
          </select>

          {/* Operational Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Fulfillment Statuses</option>
            <option value="NOT_ISSUED">NOT_ISSUED</option>
            <option value="ISSUED_TO_VENDOR">ISSUED_TO_VENDOR</option>
            <option value="IN_TRANSIT">IN_TRANSIT</option>
            <option value="PARTIALLY_RECEIVED">PARTIALLY_RECEIVED</option>
            <option value="FULLY_RECEIVED">FULLY_RECEIVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <button
          onClick={fetchData}
          title="Refresh List"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* PO Master Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">PO Number</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Total Value (₹)</th>
                <th className="px-5 py-3">Approval</th>
                <th className="px-5 py-3">Fulfillment Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      <span>Loading purchase orders...</span>
                    </div>
                  </td>
                </tr>
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No purchase orders match the selected filters.
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po) => {
                  const total = po.items.reduce(
                    (sum, it) => sum + it.quantity_ordered * Number(it.unit_price),
                    0
                  );

                  return (
                    <tr
                      key={po.id}
                      onClick={() => setSelectedPO(po)}
                      className="cursor-pointer hover:bg-slate-50/75 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        PO #{po.id}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {getSupplierName(po.supplier_id)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-500">
                        {formatDateIN(po.created_at)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {po.items.length} line items
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                        {formatINR(total)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
                            po.approved_status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : po.approved_status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {po.approved_status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px]">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {po.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPO(po);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs transition-colors shadow-2xs font-medium"
                        >
                          <span>Review</span>
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

      {/* PO Detail & Lifecycle Drawer */}
      <PODetailDrawer
        isOpen={!!selectedPO}
        onClose={() => setSelectedPO(null)}
        po={selectedPO}
        supplierName={selectedPO ? getSupplierName(selectedPO.supplier_id) : ''}
        allProducts={products}
        onRefresh={fetchData}
        showToast={showToast}
      />

      {/* Create Purchase Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Issue Purchase Order</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {formError}
                </div>
              )}

              {/* Vendor Selector */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Vendor / Supplier</label>
                <select
                  value={createSupplierId}
                  onChange={(e) => setCreateSupplierId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email || s.phone || 'No contact listed'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Line items section */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Purchase Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1 text-slate-900 font-semibold hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {poItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-4">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Product</label>
                        <select
                          value={item.product_id}
                          onChange={(e) => handleItemChange(idx, 'product_id', Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} - {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Destination WH</label>
                        <select
                          value={item.warehouse_id}
                          onChange={(e) => handleItemChange(idx, 'warehouse_id', Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                        >
                          {warehouses.map((wh) => (
                            <option key={wh.id} value={wh.id}>
                              {wh.name || `WH #${wh.id}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Quantity</label>
                        <input
                          type="number"
                          min={1}
                          required
                          value={item.quantity_ordered}
                          onChange={(e) => handleItemChange(idx, 'quantity_ordered', Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Cost/Unit (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0.01}
                          required
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>

                      <div className="col-span-1 text-right pt-4">
                        {poItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Calculation summary */}
              <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-between font-mono text-xs">
                <span className="text-slate-600 font-sans">Estimated Order Total:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatINR(
                    poItems.reduce((sum, it) => sum + Number(it.quantity_ordered) * Number(it.unit_price), 0)
                  )}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Transmitting...' : 'Submit Purchase Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;

