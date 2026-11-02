import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { listFinancialLedgerApi } from '../api/financialLedger';
import { FinancialLedgerEntry } from '../types/fulfillment';
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  IndianRupee,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  X,
} from 'lucide-react';
import { formatINR, formatDateTimeIN } from '../utils/formatters';

export const FinancialLedgerPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();

  const [entries, setEntries] = useState<FinancialLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected entry for raw detail view
  const [selectedEntry, setSelectedEntry] = useState<FinancialLedgerEntry | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const data = await listFinancialLedgerApi({
        order_id: orderIdFilter ? Number(orderIdFilter) : undefined,
      });
      setEntries(data);
    } catch {
      showToast('Failed to load financial audit records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [orderIdFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter logic
  const filteredEntries = entries.filter((e) => {
    if (typeFilter && e.transaction_type.toUpperCase() !== typeFilter.toUpperCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchTx = e.transaction_id.toLowerCase().includes(q);
      const matchIdemp = e.idempotency_key?.toLowerCase().includes(q);
      const matchOrder = e.order_id.toString().includes(q);
      if (!matchTx && !matchIdemp && !matchOrder) return false;
    }
    return true;
  });

  // Aggregate metrics
  const totalInflow = entries
    .filter((e) => e.transaction_type.toUpperCase().includes('PAY') || e.transaction_type.toUpperCase().includes('CREDIT'))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalOutflow = entries
    .filter((e) => e.transaction_type.toUpperCase().includes('REFUND') || e.transaction_type.toUpperCase().includes('DEBIT'))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const netBalance = totalInflow - totalOutflow;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            Immutable Financial Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cryptographically tracked audit trail of all order settlements, transactions, idempotency keys, and refund debits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLedger}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh transactions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Settled Inflow</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 font-mono">
            {formatINR(totalInflow)}
          </div>
          <span className="text-[11px] text-slate-400">Captured customer payments</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Refund Outflow</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-700 font-mono">
            {formatINR(totalOutflow)}
          </div>
          <span className="text-[11px] text-slate-400">Returned / reversed debits</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Net Audited Flow</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-xl font-bold font-mono ${netBalance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
            {formatINR(netBalance)}
          </div>
          <span className="text-[11px] text-slate-400">{entries.length} immutable records</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Transaction ID or Idempotency Key..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden focus:border-slate-400 font-mono transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="number"
            placeholder="Filter Order #..."
            value={orderIdFilter}
            onChange={(e) => setOrderIdFilter(e.target.value)}
            className="w-32 py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden font-mono"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-hidden text-slate-700"
        >
          <option value="">All Transaction Types</option>
          <option value="PAYMENT">PAYMENT</option>
          <option value="REFUND">REFUND</option>
        </select>

        {(orderIdFilter || typeFilter || searchQuery) && (
          <button
            onClick={() => {
              setOrderIdFilter('');
              setTypeFilter('');
              setSearchQuery('');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
          >
            Clear Filters
          </button>
        )}

        <div className="ml-auto text-xs text-slate-400 font-mono">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
            <span className="text-xs font-mono">Loading financial audit records...</span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-900">No ledger entries recorded</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Settled payments and processed order refunds will be immutably recorded here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Entry #</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Amount (₹)</th>
                  <th className="py-3 px-4">Idempotency Key</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEntries.map((entry) => {
                  const isRefund =
                    entry.transaction_type.toUpperCase().includes('REFUND') ||
                    entry.transaction_type.toUpperCase().includes('DEBIT');

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        #{entry.id}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        #{entry.order_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-slate-800">
                          <span className="truncate max-w-[140px]" title={entry.transaction_id}>
                            {entry.transaction_id}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(entry.transaction_id, `tx-${entry.id}`);
                            }}
                            className="text-slate-400 hover:text-slate-600 p-0.5"
                            title="Copy Transaction ID"
                          >
                            {copiedId === `tx-${entry.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isRefund
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {entry.transaction_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-700 font-medium">
                          {entry.payment_mode}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-mono font-bold ${
                            isRefund ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {isRefund ? '-' : '+'}{formatINR(entry.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                        {entry.idempotency_key ? (
                          <div className="flex items-center gap-1">
                            <span className="truncate max-w-[120px]" title={entry.idempotency_key}>
                              {entry.idempotency_key}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(entry.idempotency_key!, `idemp-${entry.id}`);
                              }}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Copy Idempotency Key"
                            >
                              {copiedId === `idemp-${entry.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {entry.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {entry.created_at ? formatDateTimeIN(entry.created_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Raw Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Ledger Entry #{selectedEntry.id}</h3>
                  <p className="text-xs text-slate-500 font-mono">Order #{selectedEntry.order_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Transaction Type:</span>
                  <span className="font-bold text-slate-900">{selectedEntry.transaction_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Amount:</span>
                  <span className="font-bold text-emerald-700">{formatINR(selectedEntry.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Payment Mode:</span>
                  <span className="text-slate-800">{selectedEntry.payment_mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Status:</span>
                  <span className="text-emerald-700 font-bold">{selectedEntry.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Timestamp:</span>
                  <span className="text-slate-700">{formatDateTimeIN(selectedEntry.created_at)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-500 font-sans block text-[11px]">Transaction ID</span>
                <div className="p-2 bg-slate-100 rounded text-slate-800 text-[11px] break-all select-all">
                  {selectedEntry.transaction_id}
                </div>
              </div>

              {selectedEntry.idempotency_key && (
                <div className="space-y-1">
                  <span className="text-slate-500 font-sans block text-[11px]">Idempotency Key</span>
                  <div className="p-2 bg-slate-100 rounded text-slate-800 text-[11px] break-all select-all">
                    {selectedEntry.idempotency_key}
                  </div>
                </div>
              )}

              {selectedEntry.parent_transaction_id && (
                <div className="space-y-1">
                  <span className="text-slate-500 font-sans block text-[11px]">Parent Settlement Ref</span>
                  <div className="p-2 bg-slate-100 rounded text-slate-800 text-[11px]">
                    Ledger #{selectedEntry.parent_transaction_id}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100 transition-colors shadow-2xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialLedgerPage;

