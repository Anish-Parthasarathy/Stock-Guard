import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listStockApi, createStockApi } from '../api/stock';
import { listProductsApi } from '../api/products';
import { listWarehousesApi } from '../api/warehouses';
import { Stock, Product, Warehouse, StockCreatePayload } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import StatusBadge from '../components/StatusBadge';
import StockAdjustModal from '../components/StockAdjustModal';
import LedgerDrawer from '../components/LedgerDrawer';
import { formatDateIN } from '../utils/formatters';
import {
  Boxes,
  SlidersHorizontal,
  History,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  X,
  AlertTriangle,
  Layers,
} from 'lucide-react';

export const StockPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();
  const { user, isAdmin } = useAuth();

  const [stockList, setStockList] = useState<Stock[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>(
    user?.warehouse_id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals / Drawers state
  const [adjustTargetStock, setAdjustTargetStock] = useState<Stock | null>(null);
  const [ledgerTargetStock, setLedgerTargetStock] = useState<Stock | null>(null);

  // Create Stock Record Modal
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [createStockData, setCreateStockData] = useState<StockCreatePayload>({
    warehouse_id: 1,
    product_id: 1,
    quantity: 100,
    reorder_threshold: 20,
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stocks, prods, whs] = await Promise.all([
        listStockApi({
          warehouse_id: selectedWarehouseId ? Number(selectedWarehouseId) : undefined,
          low_stock: lowStockOnly ? true : undefined,
        }),
        listProductsApi().catch(() => []),
        listWarehousesApi().catch(() => []),
      ]);
      setStockList(stocks);
      setProducts(prods);
      setWarehouses(whs);
    } catch (err: any) {
      showToast('Failed to fetch stock records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouseId, lowStockOnly]);

  const handleCreateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      await createStockApi({
        warehouse_id: Number(createStockData.warehouse_id),
        product_id: Number(createStockData.product_id),
        quantity: Number(createStockData.quantity),
        reorder_threshold: Number(createStockData.reorder_threshold),
      });
      showToast('Initial stock record created successfully!');
      setShowAddStockModal(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create stock record.';
      setCreateError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setCreateSubmitting(false);
    }
  };

  const getProductName = (productId: number) => {
    const prod = products.find((p) => p.id === productId);
    return prod ? `${prod.name} (${prod.sku})` : `Product #${productId}`;
  };

  const filteredStock = stockList.filter((s) => {
    if (!searchQuery) return true;
    const name = getProductName(s.product_id).toLowerCase();
    const q = searchQuery.toLowerCase();
    return (
      name.includes(q) ||
      String(s.product_id).includes(q) ||
      String(s.warehouse_id).includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Stock Levels & Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time warehouse quantities, reorder thresholds, and optimistic concurrency version tracking.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setCreateStockData({
                warehouse_id: selectedWarehouseId ? Number(selectedWarehouseId) : 1,
                product_id: products[0]?.id || 1,
                quantity: 100,
                reorder_threshold: 20,
              });
              setCreateError(null);
              setShowAddStockModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Init Stock Item</span>
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center justify-between shadow-2xs">
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Facility Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Facility:</span>
          </div>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value ? Number(e.target.value) : '')}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name || `Warehouse #${wh.id}`}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="flex items-center gap-1 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              Low Stock Only
            </span>
          </label>

          <button
            onClick={fetchData}
            title="Refresh List"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Facility</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">On-Hand Quantity</th>
                <th className="px-5 py-3">Reorder Threshold</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">OCC Version</th>
                <th className="px-5 py-3">Last Activity</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      <span>Loading warehouse stock levels...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No inventory records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredStock.map((item) => {
                  const isLow = item.quantity <= item.reorder_threshold;
                  const isOut = item.quantity === 0;

                  return (
                    <tr
                      key={`${item.warehouse_id}-${item.product_id}`}
                      className={`hover:bg-slate-50/75 transition-colors ${
                        isLow ? 'border-l-4 border-l-amber-500 bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        WH #{item.warehouse_id}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">
                          {getProductName(item.product_id)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Product ID: #{item.product_id}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-sm text-slate-900">
                        {item.quantity.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-500">
                        {item.reorder_threshold.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge
                          status={isOut ? 'OUT_OF_STOCK' : isLow ? 'LOW_STOCK' : 'OPTIMAL'}
                          type="stock"
                        />
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                        v{item.version}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                        {formatDateIN(item.updated_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setAdjustTargetStock(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs transition-colors shadow-2xs font-medium"
                        >
                          <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                          <span>Adjust</span>
                        </button>
                        <button
                          onClick={() => setLedgerTargetStock(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded text-xs transition-colors shadow-2xs"
                          title="View Movement Audit Trail"
                        >
                          <History className="w-3 h-3" />
                          <span>Ledger</span>
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

      {/* Stock Adjust Modal */}
      <StockAdjustModal
        isOpen={!!adjustTargetStock}
        onClose={() => setAdjustTargetStock(null)}
        stock={adjustTargetStock}
        productName={adjustTargetStock ? getProductName(adjustTargetStock.product_id) : ''}
        onSuccess={(msg) => {
          showToast(msg);
          fetchData();
        }}
      />

      {/* Stock Movement Ledger Drawer */}
      <LedgerDrawer
        isOpen={!!ledgerTargetStock}
        onClose={() => setLedgerTargetStock(null)}
        warehouseId={ledgerTargetStock?.warehouse_id}
        productId={ledgerTargetStock?.product_id}
        productName={ledgerTargetStock ? getProductName(ledgerTargetStock.product_id) : ''}
      />

      {/* Initial Stock Record Modal */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Initialize Facility Stock</h3>
              </div>
              <button
                onClick={() => setShowAddStockModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStock} className="p-6 space-y-3.5 text-xs">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Target Facility</label>
                  <select
                    value={createStockData.warehouse_id}
                    onChange={(e) =>
                      setCreateStockData({ ...createStockData, warehouse_id: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name || `Facility #${wh.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Product</label>
                  <select
                    value={createStockData.product_id}
                    onChange={(e) =>
                      setCreateStockData({ ...createStockData, product_id: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Initial Quantity</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={createStockData.quantity}
                    onChange={(e) =>
                      setCreateStockData({ ...createStockData, quantity: Number(e.target.value) })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Reorder Threshold</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={createStockData.reorder_threshold}
                    onChange={(e) =>
                      setCreateStockData({
                        ...createStockData,
                        reorder_threshold: Number(e.target.value),
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStockModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {createSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{createSubmitting ? 'Initializing...' : 'Save Stock Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPage;

