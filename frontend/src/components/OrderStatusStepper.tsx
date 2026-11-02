import React from 'react';

interface OrderStatusStepperProps {
  orderStatus: string;
  paymentStatus: string;
}

export const OrderStatusStepper: React.FC<OrderStatusStepperProps> = ({
  orderStatus,
  paymentStatus,
}) => {
  const isCancelled = orderStatus.toUpperCase() === 'CANCELLED';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-mono text-rose-700">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span className="font-bold">ORDER CANCELLED & RESERVATIONS RELEASED</span>
      </div>
    );
  }

  const steps = [
    { label: 'Stock Reserved', done: true },
    { label: 'Payment Settled', done: paymentStatus.toUpperCase() === 'PAID' },
    {
      label: 'Fulfillment',
      done: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(
        orderStatus.toUpperCase()
      ),
    },
    {
      label: 'Delivered',
      done: ['DELIVERED', 'COMPLETED'].includes(orderStatus.toUpperCase()),
    },
  ];

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
      {steps.map((step, idx) => (
        <div key={step.label} className="flex items-center gap-2">
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] ${
              step.done
                ? 'bg-slate-900 text-white'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {step.done ? '✓' : idx + 1}
          </div>
          <span
            className={`text-[11px] ${
              step.done ? 'font-semibold text-slate-900' : 'text-slate-400'
            }`}
          >
            {step.label}
          </span>
          {idx < steps.length - 1 && (
            <div className="w-8 h-0.5 bg-slate-200 mx-2 hidden sm:block" />
          )}
        </div>
      ))}
    </div>
  );
};

export default OrderStatusStepper;

