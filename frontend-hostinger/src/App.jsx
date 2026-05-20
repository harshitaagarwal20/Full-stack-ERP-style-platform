import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import GlobalNotification from "./components/common/GlobalNotification";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

const ApprovalPage = lazy(() => import("./pages/ApprovalPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DispatchPage = lazy(() => import("./pages/DispatchPage"));
const EnquiryPage = lazy(() => import("./pages/EnquiryPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MasterDataPage = lazy(() => import("./pages/MasterDataPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const OrderPage = lazy(() => import("./pages/OrderPage"));
const ActivityLogPage = lazy(() => import("./pages/ActivityLogPage"));
const ProductionPage = lazy(() => import("./pages/ProductionPage"));
const ProductionCompletePage = lazy(() => import("./pages/ProductionCompletePage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const PendingExportDatePage = lazy(() => import("./pages/PendingExportDatePage"));
const PurchaseOrderListPage = lazy(() => import("./pages/PurchaseOrderListPage"));
const PurchaseOrderFormPage = lazy(() => import("./pages/PurchaseOrderFormPage"));
const PurchaseOrderDetailPage = lazy(() => import("./pages/PurchaseOrderDetailPage"));
const GrnListPage = lazy(() => import("./pages/GrnListPage"));
const GrnFormPage = lazy(() => import("./pages/GrnFormPage"));
const GrnDetailPage = lazy(() => import("./pages/GrnDetailPage"));
const PurchaseOrderPrintPage = lazy(() => import("./pages/PurchaseOrderPrintPage"));
const SupplierMasterPage = lazy(() => import("./pages/SupplierMasterPage"));
const RawMaterialPage = lazy(() => import("./pages/RawMaterialPage"));
const ProductionDetailPage = lazy(() => import("./pages/ProductionDetailPage"));

const ROLES = {
  ADMIN: "admin",
  SALES: "sales",
  PRODUCTION: "production",
  DISPATCH: "dispatch"
};

const ENQUIRY_ROLES = [ROLES.ADMIN, ROLES.SALES];
const ORDER_ROLES = [ROLES.ADMIN, ROLES.SALES];
const PO_ROLES = [ROLES.ADMIN];
const PRODUCTION_ROLES = [ROLES.ADMIN, ROLES.PRODUCTION];
const DISPATCH_ROLES = [ROLES.ADMIN, ROLES.DISPATCH];

function RouteFallback() {
  return (
    <div style={{ padding: "16px", color: "#64748b", fontSize: "14px" }}>
      Loading...
    </div>
  );
}

function withSuspense(node) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

function HomeRedirect() {
  const { user } = useAuth();

  if (user?.role === ROLES.PRODUCTION) {
    return <Navigate to="/production" replace />;
  }

  if (user?.role === ROLES.DISPATCH) {
    return <Navigate to="/dispatch" replace />;
  }

  return withSuspense(<DashboardPage />);
}

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <GlobalNotification />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : withSuspense(<LoginPage />)} />

        {/* Print routes — no Layout/navbar */}
        <Route element={<ProtectedRoute roles={PO_ROLES} />}>
          <Route path="/purchase-orders/:id/print" element={withSuspense(<PurchaseOrderPrintPage />)} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRedirect />} />

            <Route element={<ProtectedRoute roles={ENQUIRY_ROLES} />}>
              <Route path="/enquiries" element={withSuspense(<EnquiryPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.SALES]} />}>
              <Route path="/approval" element={withSuspense(<ApprovalPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
              <Route path="/activity-log" element={withSuspense(<ActivityLogPage />)} />
              <Route path="/master-data" element={withSuspense(<MasterDataPage />)} />
              <Route path="/supplier-data" element={withSuspense(<SupplierMasterPage />)} />
              <Route path="/users" element={withSuspense(<UsersPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={ORDER_ROLES} />}>
              <Route path="/orders" element={withSuspense(<OrderPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={PO_ROLES} />}>
              <Route path="/purchase-orders" element={withSuspense(<PurchaseOrderListPage />)} />
              <Route path="/purchase-orders/new" element={withSuspense(<PurchaseOrderFormPage />)} />
              <Route path="/purchase-orders/:id" element={withSuspense(<PurchaseOrderDetailPage />)} />
              <Route path="/purchase-orders/:id/edit" element={withSuspense(<PurchaseOrderFormPage />)} />
              <Route path="/grns" element={withSuspense(<GrnListPage />)} />
              <Route path="/grns/new" element={withSuspense(<GrnFormPage />)} />
              <Route path="/grns/:id" element={withSuspense(<GrnDetailPage />)} />
              <Route path="/raw-materials" element={withSuspense(<RawMaterialPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={PRODUCTION_ROLES} />}>
              <Route path="/production" element={withSuspense(<ProductionPage />)} />
              <Route path="/production/:id" element={withSuspense(<ProductionDetailPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={PRODUCTION_ROLES} />}>
              <Route path="/production/complete/:id" element={withSuspense(<ProductionCompletePage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={DISPATCH_ROLES} />}>
              <Route path="/dispatch" element={withSuspense(<DispatchPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={DISPATCH_ROLES} />}>
              <Route path="/pending-dispatch-date" element={withSuspense(<PendingExportDatePage />)} />
              <Route path="/pending-export-date" element={<Navigate to="/pending-dispatch-date" replace />} />
            </Route>

            <Route path="*" element={withSuspense(<NotFoundPage />)} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;
