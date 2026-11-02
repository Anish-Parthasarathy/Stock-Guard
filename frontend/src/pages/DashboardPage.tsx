import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getWarehouseCapacityApi,
  getLowStockAlertsApi,
  getDeadStockApi,
  getFulfillmentMetricsApi,
  getSupplierPerformanceApi,
} from '../api/analytics';
import { listWarehousesApi } from '../api/warehouses';
import {
  WarehouseCapacityMetric,
  LowStockAlert,
  DeadStockItem,
  FulfillmentMetrics,
  SupplierPerformanceMetric,
} from '../types/analytics';
import { Warehouse } from '../types/inventory';
import KPICard from '../components/KPICard';
import WarehouseCapacityChart from '../components/WarehouseCapacityChart';
import LowStockAlertTable from '../components/LowStockAlertTable';
import DeadStockTable from '../components/DeadStockTable';
import FulfillmentMetricsPanel from '../components/FulfillmentMetricsPanel';
import SupplierPerformanceChart from '../components/SupplierPerformanceChart';
import { formatINR } from '../utils/formatters';
import {
  BarChart3,
  RefreshCw,
  Building2,
  AlertTriangle,
  Archive,
  Activity,
  Layers,
  Filter,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useOutletContext<{ showToast: (msg: string) => void }>();

  // Data states
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [capacityMetrics, setCapacityMetrics] = useState<WarehouseCapacityMetric[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [deadStockItems, setDeadStockItems] = useState<DeadStockItem[]>([]);
  const [fulfillmentMetrics, setFulfillmentMetrics] = useState<FulfillmentMetrics | null>(null);
  const [supplierMetrics, setSupplierMetrics] = useState<SupplierPerformanceMetric[]>([]);

  // Controls
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>(
    user?.warehouse_id || ''
  );
  const [deadStockDays, setDeadStockDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch all dashboard analytics
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const whId = selectedWarehouseId ? Number(selectedWarehouseId) : undefined;

      const [capData, lowData, deadData, fulfillData, supData, whListData] = await Promise.all([
        getWarehouseCapacityApi(whId),
        getLowStockAlertsApi(whId),
        getDeadStockApi(deadStockDays, whId),
        getFulfillmentMetricsApi(whId),
        getSupplierPerformanceApi(),
        listWarehousesApi(),
      ]);

      setCapacityMetrics(capData);
      setLowStockAlerts(lowData);
      setDeadStockItems(deadData);
      setFulfillmentMetrics(fulfillData);
      setSupplierMetrics(supData);
      setWarehouses(whListData);
      setLastUpdated(new Date());
    } catch {
      if (!isSilent) {
        showToast('Failed to load operational analytics.');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [selectedWarehouseId, deadStockDays, showToast]);

  // Initial load and filter change
  useEffect(() => {
    fetchDashboardData(false);
  }, [selectedWarehouseId, deadStockDays]);

  // Auto-refresh interval (every 60 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  // Calculated top-level KPIs
  const totalCapacity = capacityMetrics.reduce((sum, m) => sum + m.capacity, 0);
  const totalStockQuantity = capacityMetrics.reduce((sum, m) => sum + m.current_stock_quantity, 0);
  const avgUtilizationRate =
    totalCapacity > 0 ? (totalStockQuantity / totalCapacity) * 100 : 0;

  const totalDeadCapital = deadStockItems.reduce(
    (sum, it) => sum + Number(it.total_tied_capital),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Facility Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Operations & Warehouse Health
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry, storage load, inventory depletion alerts, and fulfillment metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Facility Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value ? Number(e.target.value) : '')}
              className="text-xs bg-transparent focus:outline-hidden font-medium text-slate-700"
            >
              <option value="">Global Network (All Facilities)</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.location})
                </option>
              ))}
            </select>
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
            title="Auto-refresh every 60s"
          >
            <Clock className="w-3 h-3" />
            <span>{autoRefresh ? '60s Auto' : 'Manual'}</span>
          </button>

          {/* Refresh Action */}
          <button
            onClick={() => fetchDashboardData(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Storage Load Rate"
          value={`${avgUtilizationRate.toFixed(1)}%`}
          subtitle={`${totalStockQuantity.toLocaleString('en-IN')} / ${totalCapacity.toLocaleString('en-IN')} units`}
          icon={<Building2 className="w-4 h-4" />}
          color={avgUtilizationRate > 90 ? 'rose' : avgUtilizationRate > 70 ? 'amber' : 'emerald'}
          loading={loading}
        />

        <KPICard
          title="Low Stock Alerts"
          value={lowStockAlerts.length}
          subtitle={lowStockAlerts.length > 0 ? 'Requires immediate restock' : 'All thresholds met'}
          icon={<AlertTriangle className="w-4 h-4" />}
          color={lowStockAlerts.length > 0 ? 'amber' : 'slate'}
          loading={loading}
        />

        <KPICard
          title="Dead Stock Capital"
          value={formatINR(totalDeadCapital)}
          subtitle={`${deadStockItems.length} idle SKUs (≥${deadStockDays} days)`}
          icon={<Archive className="w-4 h-4" />}
          color={deadStockItems.length > 0 ? 'rose' : 'slate'}
          loading={loading}
        />

        <KPICard
          title="Fulfillment Rate"
          value={fulfillmentMetrics ? `${fulfillmentMetrics.fulfillment_rate.toFixed(1)}%` : '—'}
          subtitle={
            fulfillmentMetrics
              ? `${fulfillmentMetrics.delivered_orders} / ${fulfillmentMetrics.total_orders} orders delivered`
              : 'Calculating yield'
          }
          icon={<Activity className="w-4 h-4" />}
          color="indigo"
          loading={loading}
        />
      </div>

      {/* Primary Analytics Row: Warehouse Capacity & Fulfillment Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WarehouseCapacityChart metrics={capacityMetrics} loading={loading} />
        <FulfillmentMetricsPanel metrics={fulfillmentMetrics} loading={loading} />
      </div>

      {/* Secondary Row: Low Stock Warnings & Dead Stock Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LowStockAlertTable alerts={lowStockAlerts} loading={loading} />
        <DeadStockTable
          days={deadStockDays}
          onDaysChange={(newDays) => setDeadStockDays(newDays)}
          items={deadStockItems}
          loading={loading}
        />
      </div>

      {/* Tertiary Row: Supplier Reliability */}
      <div>
        <SupplierPerformanceChart metrics={supplierMetrics} loading={loading} />
      </div>

      {/* Footer telemetry */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-2 border-t border-slate-100">
        <span>StockGuard Telemetry Engine · Real-time SQL aggregations</span>
        <span>Last updated: {lastUpdated.toLocaleTimeString('en-IN')}</span>
      </div>
    </div>
  );
};

export default DashboardPage;

