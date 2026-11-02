/**
 * StockGuard Indian Standard (en-IN) Formatting Utilities
 */

/**
 * Format monetary amount in Indian Rupees (₹) with Indian digit grouping (Lakhs, Crores).
 * e.g., 150000 -> "₹1,50,000.00"
 */
export function formatINR(amount: number | string | undefined | null): string {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format quantity / count with Indian number grouping.
 * e.g., 100000 -> "1,00,000"
 */
export function formatNumberIN(val: number | string | undefined | null): string {
  const num = Number(val) || 0;
  return num.toLocaleString('en-IN');
}

/**
 * Format date in Indian Standard Date format (DD/MM/YYYY).
 * e.g., 2026-11-02 -> "02/11/2026"
 */
export function formatDateIN(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Format date & time in Indian Standard Time (IST / 12-hour format with AM/PM).
 * e.g., "02/11/2026, 08:15 pm"
 */
export function formatDateTimeIN(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateStr);
  }
}

