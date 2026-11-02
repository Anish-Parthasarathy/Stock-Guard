import React, { useState, useEffect } from 'react';
import {
  listSupplierProductsApi,
  addSupplierProductApi,
  removeSupplierProductApi,
} from '../api/suppliers';
import { listProductsApi } from '../api/products';
import { Supplier, SupplierProduct, SupplierProductCreatePayload } from '../types/procurement';
import { Product } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import {
  Boxes,
  Plus,
  Trash2,
  Clock,
  IndianRupee,
  Loader2,
  X,
  Package,
} from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface SupplierProductsPanelProps {
  supplier: Supplier | null;
  onClose?: () => void;
  showToast: (msg: string) => void;
}

export const SupplierProductsPanel: React.FC<SupplierProductsPanelProps> = ({
  supplier,
  onClose,
  showToast,
}) => {
  const { isAdmin } = useAuth();
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Add product form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<SupplierProductCreatePayload>({
    product_id: 1,
    supplier_sku: '',
    unit_price: 15.0,
    time_required_in_days: 5,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!supplier) return;
    setLoading(true);
    try {
      const [spData, prods] = await Promise.all([
        listSupplierProductsApi(supplier.id),
        listProductsApi().catch(() => []),
      ]);
      setSupplierProducts(spData);
      setAllProducts(prods);
      if (prods.length > 0) {
        setFormData((prev) => ({ ...prev, product_id: prods[0].id }));
      }
    } catch {
      setSupplierProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplier) {
      setShowAddForm(false);
      fetchData();
    }
  }, [supplier]);

  if (!supplier) return null;

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.unit_price <= 0) {
      setFormError('Unit price must be greater than 0.');
      return;
    }

    if (formData.time_required_in_days < 0) {
      setFormError('Lead time cannot be negative.');
      return;
    }

    setSubmitting(true);
    try {
      await addSupplierProductApi(supplier.id, {
        product_id: Number(formData.product_id),
        supplier_sku: formData.supplier_sku.trim() || `SUP-SKU-${formData.product_id}`,
        unit_price: Number(formData.unit_price),
        time_required_in_days: Number(formData.time_required_in_days),
      });
      showToast('Product added to supplier catalogue!');
      setShowAddForm(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to link product to supplier.';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveProduct = async (productId: number) => {
    if (!window.confirm('Remove this product from the supplier catalogue?')) return;
    try {
      await removeSupplierProductApi(supplier.id, productId);
      showToast('Product unlinked from supplier.');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to remove product from supplier.');
    }
  };

  const getProductInfo = (productId: number) => {
    return allProducts.find((p) => p.id === productId);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-slate-600" />
            <span>Catalogue for {supplier.name}</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Vendor items, wholesale contracted pricing, and fulfillment lead times.
          </p>
        </div>
        {isAdmin && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Link SKU</span>
          </button>
        )}
      </div>

      {/* Add Product Form */}
      {showAddForm && (
        <form onSubmit={handleAddProduct} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">Link Product to Vendor</span>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {formError && (
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-[11px]">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-slate-600 mb-1">StockGuard Product</label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: Number(e.target.value) })}
              className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name} ({formatINR(p.price)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-600 mb-1">Vendor SKU</label>
              <input
                type="text"
                required
                placeholder="VEND-01"
                value={formData.supplier_sku}
                onChange={(e) => setFormData({ ...formData, supplier_sku: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Cost Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min={0.01}
                required
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Lead Time (days)</label>
              <input
                type="number"
                min={0}
                required
                value={formData.time_required_in_days}
                onChange={(e) => setFormData({ ...formData, time_required_in_days: Number(e.target.value) })}
                className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{submitting ? 'Linking...' : 'Confirm Link'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Product List */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-1.5 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading vendor catalogue...</span>
          </div>
        ) : supplierProducts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs italic">
            No products configured for this supplier yet.
          </div>
        ) : (
          supplierProducts.map((sp) => {
            const prod = getProductInfo(sp.product_id);
            return (
              <div
                key={sp.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.2 rounded font-medium text-slate-700">
                      {sp.supplier_sku}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {prod?.name || `Product #${sp.product_id}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                    <span className="text-slate-800 font-bold">
                      {formatINR(sp.unit_price)} / unit
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-slate-600">
                      <Clock className="w-3 h-3" />
                      {sp.time_required_in_days} days lead time
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => handleRemoveProduct(sp.product_id)}
                    title="Remove from supplier catalogue"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SupplierProductsPanel;

