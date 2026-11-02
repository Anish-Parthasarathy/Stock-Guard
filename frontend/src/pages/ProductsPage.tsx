import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  listProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
} from '../api/products';
import { listCategoriesApi } from '../api/categories';
import { Product, ProductCreatePayload, Category } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  X,
  Edit2,
  Trash2,
  Tags,
  IndianRupee,
} from 'lucide-react';
import { formatINR, formatDateIN } from '../utils/formatters';

export const ProductsPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();
  const { isAdmin } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState<ProductCreatePayload>({
    sku: '',
    name: '',
    price: 0,
    description: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        listProductsApi(),
        listCategoriesApi().catch(() => []),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err: any) {
      showToast('Failed to load product catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({ sku: '', name: '', price: 19.99, description: '' });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      price: product.price,
      description: product.description,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.sku.length > 12) {
      setFormError('SKU identifier cannot exceed 12 characters.');
      return;
    }

    if (formData.price < 0) {
      setFormError('Price cannot be negative.');
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingProduct) {
        await updateProductApi(editingProduct.id, formData);
        showToast(`Product '${formData.name}' updated successfully!`);
      } else {
        await createProductApi(formData);
        showToast(`Product '${formData.name}' added to catalogue!`);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Operation failed.';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete '${product.name}' (SKU: ${product.sku})?`)) {
      return;
    }
    try {
      await deleteProductApi(product.id);
      showToast(`Product '${product.name}' removed.`);
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete product.');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Product Catalogue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Master SKU inventory catalogue, retail pricing, and product details.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Product SKU</span>
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-center justify-between shadow-2xs">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by SKU, name, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-colors"
          />
        </div>

        <button
          onClick={fetchData}
          title="Refresh List"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 self-end md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">Unit Price (₹)</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Last Updated</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                      <span>Loading products...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-900">
                      <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                        {prod.sku}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-900">{prod.name}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-800">
                      {formatINR(prod.price)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate" title={prod.description}>
                      {prod.description}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                      {formatDateIN(prod.updated_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-1">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(prod)}
                            title="Edit Product"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(prod)}
                            title="Delete Product"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingProduct ? 'Edit Product Details' : 'Add New Product SKU'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3.5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    SKU Code <span className="text-slate-400 font-normal">(max 12)</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="e.g. SKU-1001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Price (₹ INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Industrial Sensor Node v2"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Technical specifications, dimensions, packaging details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{formSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;

