import React, { useState } from 'react';
import apiClient from '../api/client';
import { X, Play, Terminal, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface SimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SimulatorDrawer: React.FC<SimulatorDrawerProps> = ({ isOpen, onClose }) => {
  const [warehouseId, setWarehouseId] = useState(1);
  const [extRef, setExtRef] = useState(() => `EXT-${Math.floor(100000 + Math.random() * 900000)}`);
  const [productId, setProductId] = useState(1);
  const [quantity, setQuantity] = useState(2);
  const [unitPrice, setUnitPrice] = useState(1499.00);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; data?: any; error?: string } | null>(null);

  if (!isOpen) return null;

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const payload = {
      warehouse_id: Number(warehouseId),
      external_reference_id: extRef,
      reservation_duration_minutes: Number(durationMinutes),
      items: [
        {
          product_id: Number(productId),
          quantity: Number(quantity),
          unit_price: Number(unitPrice),
        },
      ],
    };

    try {
      const response = await apiClient.post('/orders', payload);
      setResult({ success: true, data: response.data });
      // Generate a new external reference for the next simulation
      setExtRef(`EXT-${Math.floor(100000 + Math.random() * 900000)}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Simulation request failed';
      setResult({ success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-md">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">E-Commerce Webhook Simulator</h3>
              <p className="text-[11px] text-slate-500">
                Simulates external incoming order API payloads
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

        {/* Content */}
        <form onSubmit={handleSimulate} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px] leading-relaxed">
            StockGuard is an internal inventory & warehouse management system. Real orders originate from external platforms. Use this simulator to inject inbound test orders and verify stock reservations, locks, and status transitions.
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">External Order Reference ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={extRef}
                onChange={(e) => setExtRef(e.target.value)}
                className="flex-1 font-mono text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <button
                type="button"
                onClick={() => setExtRef(`EXT-${Math.floor(100000 + Math.random() * 900000)}`)}
                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-lg font-mono"
              >
                Gen
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Target Warehouse ID</label>
              <input
                type="number"
                min={1}
                required
                value={warehouseId}
                onChange={(e) => setWarehouseId(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Reservation Hold (min)</label>
              <input
                type="number"
                min={1}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <h4 className="font-semibold text-slate-800 mb-2">Simulated Order Item</h4>
            <div className="space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Product ID</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={productId}
                  onChange={(e) => setProductId(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results section */}
          {result && (
            <div className={`p-3.5 rounded-lg border text-xs ${
              result.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                {result.success ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Order Dispatched & Reserved</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Simulation Error</span>
                  </>
                )}
              </div>
              {result.success ? (
                <div className="space-y-1 font-mono text-[11px] mt-1.5 text-emerald-800">
                  <div>Internal Order ID: #{result.data.id}</div>
                  <div>Status: {result.data.order_status}</div>
                  <div>Total: ₹{Number(result.data.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div>Reservations Created: {result.data.reservations?.length || 0}</div>
                </div>
              ) : (
                <div className="text-[11px] mt-1 text-rose-700">{result.error}</div>
              )}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{loading ? 'Transmitting Inbound Order...' : 'Inject Simulated Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimulatorDrawer;

