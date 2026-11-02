import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import WarehousesPage from './pages/WarehousesPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import StockPage from './pages/StockPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import OrdersPage from './pages/OrdersPage';
import DeliveriesPage from './pages/DeliveriesPage';
import TransfersPage from './pages/TransfersPage';
import ReturnsPage from './pages/ReturnsPage';
import FinancialLedgerPage from './pages/FinancialLedgerPage';
import DashboardPage from './pages/DashboardPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public login route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Authenticated Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Phase 1 Implemented Module: Admin Users */}
          <Route
            path="users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />

          {/* Phase 5 Implemented Module: Analytics & Metrics Dashboard */}
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Phase 2 Implemented Modules: Inventory Core */}
          <Route path="stock" element={<StockPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="warehouses" element={<WarehousesPage />} />

          {/* Phase 3 Implemented Modules: Procurement */}
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />

          {/* Phase 4 Implemented Modules: Fulfillment & Operations */}
          <Route path="orders" element={<OrdersPage />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="financial-ledger" element={<FinancialLedgerPage />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;

