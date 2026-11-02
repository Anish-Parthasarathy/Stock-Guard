import React, { useState } from 'react';
import { dispatchTransferApi } from '../api/transfers';
import { TransferCreatePayload, TransferItemCreatePayload } from '../types/fulfillment';
import { Product, Warehouse } from '../types/inventory';
import { ArrowRightLeft, Plus, Trash2, X, Loader2 } from 'lucide-react';

interface DispatchTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  products: Product[];
  onSuccess: () => void;
  showToast: (msg: string) => void;
}

export const DispatchTransferModal: React.FC<DispatchTransferModalProps> = ({
  isOpen,
  onClose,
  warehouses,
  products,
  onSuccess,
  showToast,
}) => {
  const [sourceWarehouseId, setSourceWarehouseId] = useState<number>(warehouses[0]?.id || 1);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<number>(
    warehouses[1]?.id || (warehouses[0]?.id ? warehouses[0].id + 1 : 2)
  );
  const [transportMode, setTransportMode] = useState<string>('ROAD');
  const [expectedCompletion, setExpectedCompletion] = useState<string>(() => {
    const d = new Date(Date.now() + 48 * 3600000);
    return d.toISOString().slice(0, 16);
  });
  const [items, setItems] = useState<TransferItemCreatePayload[]>([
    {
      product_id: products[0]?.id || 1,
      quantity_dispatched: 10,
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        product_id: products[0]?.id || 1,
        quantity_dispatched: 10,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof TransferItemCreatePayload, val: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: Number(val) };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (sourceWarehouseId === destinationWarehouseId) {
      setError('Source and Destination facilities cannot be identical.');
      return;
    }

    if (items.length === 0) {
      setError('Add at least one item to transfer.');
      return;
    }

    for (const it of items) {
      if (it.quantity_dispatched <= 0) {
        setError('Transfer quantities must be greater than 0.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: TransferCreatePayload = {
        source_warehouse_id: Number(sourceWarehouseId),
        destination_warehouse_id: Number(destinationWarehouseId),
        transport_mode: transportMode,
        expected_completion: new Date(expectedCompletion).toISOString(),
        items,
      };

      await dispatchTransferApi(payload);
      showToast('Transfer dispatched! Stock deducted from source facility.');
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Dispatch failed.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Dispatch Inter-Warehouse Transfer</h3>
              <p className="text-xs text-slate-500">Balance inventory across facilities</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Source Facility</label>
              <select
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name || `Facility #${wh.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Destination Facility</label>
              <select
                value={destinationWarehouseId}
                onChange={(e) => setDestinationWarehouseId(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name || `Facility #${wh.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Transport Mode</label>
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900"
              >
                <option value="ROAD">Road Freight (Truck / Lorry)</option>
                <option value="RAIL">Indian Railways Freight</option>
                <option value="AIR">Air Cargo</option>
                <option value="EXPRESS">Surface Express / Courier</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Expected Completion</label>
              <input
                type="datetime-local"
                required
                value={expectedCompletion}
                onChange={(e) => setExpectedCompletion(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900"
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Items to Transfer</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-slate-900 font-semibold hover:underline inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-8">
                    <label className="text-[10px] text-slate-400 block mb-0.5">Product</label>
                    <select
                      value={it.product_id}
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
                    <label className="text-[10px] text-slate-400 block mb-0.5">Qty</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={it.quantity_dispatched}
                      onChange={(e) => handleItemChange(idx, 'quantity_dispatched', Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>

                  <div className="col-span-1 text-right pt-3">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
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

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
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
              <span>{submitting ? 'Dispatching...' : 'Dispatch Transfer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DispatchTransferModal;

