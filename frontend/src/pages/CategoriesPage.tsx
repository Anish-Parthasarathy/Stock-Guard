import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  listCategoriesApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
  listProductsByCategoryApi,
  assignProductToCategoryApi,
  removeProductFromCategoryApi,
} from '../api/categories';
import { listProductsApi } from '../api/products';
import { Category, Product } from '../types/inventory';
import { useAuth } from '../hooks/useAuth';
import {
  Tags,
  Plus,
  RefreshCw,
  Loader2,
  X,
  Edit2,
  Trash2,
  ChevronRight,
  PackagePlus,
  FolderOpen,
} from 'lucide-react';

export const CategoriesPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();
  const { isAdmin } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Category for product viewing/assignment drawer
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [loadingCategoryProducts, setLoadingCategoryProducts] = useState(false);
  const [productToAssign, setProductToAssign] = useState<number | ''>('');

  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const [cats, prods] = await Promise.all([
        listCategoriesApi(),
        listProductsApi().catch(() => []),
      ]);
      setCategories(cats);
      setAllProducts(prods);
    } catch (err: any) {
      showToast('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCategoryProducts = async (cat: Category) => {
    setSelectedCategory(cat);
    setLoadingCategoryProducts(true);
    try {
      const prods = await listProductsByCategoryApi(cat.id);
      setCategoryProducts(prods);
    } catch {
      setCategoryProducts([]);
    } finally {
      setLoadingCategoryProducts(false);
    }
  };

  const handleAssignProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !productToAssign) return;
    try {
      await assignProductToCategoryApi(selectedCategory.id, Number(productToAssign));
      showToast('Product linked to category successfully!');
      setProductToAssign('');
      openCategoryProducts(selectedCategory);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to assign product.');
    }
  };

  const handleRemoveProduct = async (productId: number) => {
    if (!selectedCategory) return;
    try {
      await removeProductFromCategoryApi(selectedCategory.id, productId);
      showToast('Product unlinked from category.');
      openCategoryProducts(selectedCategory);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to unlink product.');
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryName.trim()) {
      setError('Category name cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategoryApi(editingCategory.id, { name: categoryName.trim() });
        showToast(`Category updated to '${categoryName}'`);
      } else {
        await createCategoryApi({ name: categoryName.trim() });
        showToast(`Category '${categoryName}' created!`);
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Operation failed.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`Are you sure you want to delete category '${cat.name}'?`)) {
      return;
    }
    try {
      await deleteCategoryApi(cat.id);
      showToast(`Category '${cat.name}' deleted.`);
      if (selectedCategory?.id === cat.id) {
        setSelectedCategory(null);
      }
      fetchCategories();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete category.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Product Categories</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize products into classification groups and taxonomies.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Category</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories Table (2 cols on large screen) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Classification Groups</span>
              <button
                onClick={fetchCategories}
                title="Refresh Categories"
                className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">ID</th>
                    <th className="px-5 py-3">Category Name</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                          <span>Loading categories...</span>
                        </div>
                      </td>
                    </tr>
                  ) : categories.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-12 text-center text-slate-400">
                        No categories found. Create your first category above.
                      </td>
                    </tr>
                  ) : (
                    categories.map((cat) => (
                      <tr
                        key={cat.id}
                        onClick={() => openCategoryProducts(cat)}
                        className={`cursor-pointer transition-colors ${
                          selectedCategory?.id === cat.id ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50/50'
                        }`}
                      >
                        <td className="px-5 py-3.5 font-mono text-slate-400">#{cat.id}</td>
                        <td className="px-5 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                          <span>{cat.name}</span>
                          {selectedCategory?.id === cat.id && (
                            <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.2 rounded font-mono">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openCategoryProducts(cat)}
                            title="Inspect Products"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditModal(cat)}
                                title="Edit Category"
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(cat)}
                                title="Delete Category"
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
        </div>

        {/* Assigned Products Side Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-semibold text-slate-900">
                {selectedCategory ? `Products in '${selectedCategory.name}'` : 'Category Items'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {selectedCategory
                ? 'Manage SKU assignments for this category.'
                : 'Select a category row to inspect assigned products.'}
            </p>
          </div>

          {selectedCategory && (
            <>
              {/* Add product to category dropdown */}
              {isAdmin && (
                <form onSubmit={handleAssignProduct} className="flex gap-2">
                  <select
                    value={productToAssign}
                    onChange={(e) => setProductToAssign(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">Select product to assign...</option>
                    {allProducts
                      .filter((p) => !categoryProducts.some((cp) => cp.id === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} - {p.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!productToAssign}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              {/* List of assigned products */}
              <div className="space-y-2">
                {loadingCategoryProducts ? (
                  <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-1.5 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading products...</span>
                  </div>
                ) : categoryProducts.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    No products currently assigned to this category.
                  </div>
                ) : (
                  categoryProducts.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono text-[10px] bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-700 block w-fit mb-0.5">
                          {p.sku}
                        </span>
                        <div className="font-medium text-slate-900 truncate max-w-[180px]">{p.name}</div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveProduct(p.id)}
                          title="Unlink product"
                          className="text-slate-400 hover:text-rose-600 p-1 hover:bg-white rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Tags className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingCategory ? 'Edit Category' : 'Create Category'}
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
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Semiconductors, Power Supplies..."
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
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
                  disabled={submitting}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;

