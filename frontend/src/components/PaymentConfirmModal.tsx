import React, { useState } from 'react';
import { processOrderPaymentApi } from '../api/orders';
import { Order, PaymentCreatePayload } from '../types/fulfillment';
import { CreditCard, X, Loader2, AlertCircle } from 'lucide-react';
import { formatINR } from '../utils/formatters';

interface PaymentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSuccess: () => void;
  showToast: (msg: string) => void;
}

export const PaymentConfirmModal: React.FC<PaymentConfirmModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
  showToast,
}) => {
  const [paymentMode, setPaymentMode] = useState('CREDIT_CARD');
  const [amount, setAmount] = useState<number>(order.total_amount);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(
    () => `IDEMP-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amount < order.total_amount) {
      setError(`Payment amount (${formatINR(amount)}) cannot be less than order total (${formatINR(order.total_amount)}).`);
      return;
    }

    setSubmitting(true);
    try {
      const payload: PaymentCreatePayload = {
        amount: Number(amount),
        payment_mode: paymentMode,
        idempotency_key: idempotencyKey.trim() || undefined,
      };

      await processOrderPaymentApi(order.id, payload);
      showToast(`Payment of ${formatINR(amount)} settled for Order #${order.id}! Financial ledger updated.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Payment processing failed.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Settle Order Payment</h3>
              <p className="text-xs text-slate-500 font-mono">Order #{order.id} · Ref: {order.external_reference_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
            <span className="text-slate-600 font-medium">Order Total Required:</span>
            <span className="font-mono font-bold text-slate-900 text-base">
              {formatINR(order.total_amount)}
            </span>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
              <option value="NET_BANKING">Net Banking (IMPS / NEFT / RTGS)</option>
              <option value="CARD">Debit / Credit Card (RuPay / Visa / MC)</option>
              <option value="CASH">Cash on Delivery (COD)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Settlement Amount (₹ INR)</label>
            <input
              type="number"
              step="0.01"
              min={order.total_amount}
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-700">Idempotency Key</label>
              <span className="text-[10px] text-slate-400 font-mono">Deduplication Guard</span>
            </div>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
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
              <span>{submitting ? 'Settling...' : 'Confirm Settlement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentConfirmModal;

