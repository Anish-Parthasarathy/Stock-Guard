import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Boxes,
  Warehouse as WarehouseIcon,
  Package,
  Tags,
  Layers,
  Truck,
  FileSpreadsheet,
  ArrowRightLeft,
  RotateCcw,
  Receipt,
  Users,
  BarChart3,
  Terminal,
} from 'lucide-react';

interface SidebarProps {
  onOpenSimulator?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSimulator }) => {
  const { user, isAdmin } = useAuth();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
      isActive
        ? 'bg-slate-900 text-white shadow-sm'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
            SG
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm tracking-tight block">StockGuard</span>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">
              WMS Platform
            </span>
          </div>
        </div>
      </div>

      {/* Nav links scroll area */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Analytics / Overview */}
        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            Overview
          </div>
          <div className="space-y-0.5">
            <NavLink to="/dashboard" className={navLinkClass}>
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Analytics & KPIs</span>
            </NavLink>
          </div>
        </div>

        {/* Inventory Core */}
        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            Inventory
          </div>
          <div className="space-y-0.5">
            <NavLink to="/stock" className={navLinkClass}>
              <Boxes className="w-4 h-4 shrink-0" />
              <span>Stock Levels & Ledger</span>
            </NavLink>
            <NavLink to="/products" className={navLinkClass}>
              <Package className="w-4 h-4 shrink-0" />
              <span>Product Catalogue</span>
            </NavLink>
            <NavLink to="/categories" className={navLinkClass}>
              <Tags className="w-4 h-4 shrink-0" />
              <span>Categories</span>
            </NavLink>
            <NavLink to="/warehouses" className={navLinkClass}>
              <WarehouseIcon className="w-4 h-4 shrink-0" />
              <span>Warehouses</span>
            </NavLink>
          </div>
        </div>

        {/* Procurement */}
        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            Procurement
          </div>
          <div className="space-y-0.5">
            <NavLink to="/purchase-orders" className={navLinkClass}>
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Purchase Orders</span>
            </NavLink>
            <NavLink to="/suppliers" className={navLinkClass}>
              <Truck className="w-4 h-4 shrink-0" />
              <span>Suppliers</span>
            </NavLink>
          </div>
        </div>

        {/* Fulfillment & Logistics */}
        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
            Fulfillment & Ops
          </div>
          <div className="space-y-0.5">
            <NavLink to="/orders" className={navLinkClass}>
              <Layers className="w-4 h-4 shrink-0" />
              <span>Incoming Orders</span>
            </NavLink>
            <NavLink to="/deliveries" className={navLinkClass}>
              <Truck className="w-4 h-4 shrink-0" />
              <span>Deliveries</span>
            </NavLink>
            <NavLink to="/transfers" className={navLinkClass}>
              <ArrowRightLeft className="w-4 h-4 shrink-0" />
              <span>Transfers</span>
            </NavLink>
            <NavLink to="/returns" className={navLinkClass}>
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Returns & Reverse</span>
            </NavLink>
            <NavLink to="/financial-ledger" className={navLinkClass}>
              <Receipt className="w-4 h-4 shrink-0" />
              <span>Financial Ledger</span>
            </NavLink>
          </div>
        </div>

        {/* Administration */}
        {isAdmin && (
          <div>
            <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
              Administration
            </div>
            <div className="space-y-0.5">
              <NavLink to="/users" className={navLinkClass}>
                <Users className="w-4 h-4 shrink-0" />
                <span>User Management</span>
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Footer simulation button & facility badge */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        <button
          onClick={onOpenSimulator}
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-2xs"
        >
          <span className="flex items-center gap-1.5 text-amber-600">
            <Terminal className="w-3.5 h-3.5" />
            <span>API Simulator</span>
          </span>
          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-sans">
            Dev
          </span>
        </button>

        <div className="px-2 py-1 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Facility</span>
          <span className="font-mono text-slate-700 font-medium">
            {user?.warehouse_id ? `WH #${user.warehouse_id}` : 'Global HQ'}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

