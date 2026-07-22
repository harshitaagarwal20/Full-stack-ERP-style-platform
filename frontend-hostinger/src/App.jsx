import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import GlobalNotification from "./components/common/GlobalNotification";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { usePermissions } from "./context/PermissionContext";

const ApprovalPage = lazy(() => import("./pages/ApprovalPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DispatchPage = lazy(() => import("./pages/DispatchPage"));
const PackingPage = lazy(() => import("./pages/PackingPage"));
const EnquiryPage = lazy(() => import("./pages/EnquiryPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MasterDataPage = lazy(() => import("./pages/MasterDataPage"));
const DropdownMastersPage = lazy(() => import("./pages/DropdownMastersPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const OrderPage = lazy(() => import("./pages/OrderPage"));
const ProductionPage = lazy(() => import("./pages/ProductionPage"));
const ProductionCompletePage = lazy(() => import("./pages/ProductionCompletePage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const PendingExportDatePage = lazy(() => import("./pages/PendingExportDatePage"));
const PurchaseOrderListPage = lazy(() => import("./pages/PurchaseOrderListPage"));
const PurchaseOrderFormPage = lazy(() => import("./pages/PurchaseOrderFormPage"));
const PurchaseOrderDetailPage = lazy(() => import("./pages/PurchaseOrderDetailPage"));
const PurchaseOrderPricingPage = lazy(() => import("./pages/PurchaseOrderPricingPage"));
const GrnListPage = lazy(() => import("./pages/GrnListPage"));
const GrnFormPage = lazy(() => import("./pages/GrnFormPage"));
const GrnDetailPage = lazy(() => import("./pages/GrnDetailPage"));
const PurchaseOrderPrintPage = lazy(() => import("./pages/PurchaseOrderPrintPage"));
const SupplierMasterPage = lazy(() => import("./pages/SupplierMasterPage"));
const ProductMasterPage = lazy(() => import("./pages/ProductMasterPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const RawMaterialPage = lazy(() => import("./pages/RawMaterialPage"));
const PackingMaterialInventoryPage = lazy(() => import("./pages/PackingMaterialInventoryPage"));
const FinishedGoodsInventoryPage = lazy(() => import("./pages/FinishedGoodsInventoryPage"));
const ProductionOverviewPage = lazy(() => import("./pages/ProductionOverviewPage"));
const ProductionBatchSetupPage = lazy(() => import("./pages/ProductionBatchSetupPage"));
const ProductionMaterialStepPage = lazy(() => import("./pages/ProductionMaterialStepPage"));
const ProductionEquipmentPage = lazy(() => import("./pages/ProductionEquipmentPage"));
const ProductionProcessParamsPage = lazy(() => import("./pages/ProductionProcessParamsPage"));
const ProductionOperationLogPage = lazy(() => import("./pages/ProductionOperationLogPage"));
const ProductionInProcessTestPage = lazy(() => import("./pages/ProductionInProcessTestPage"));
const ProductionQcTestSheetPage = lazy(() => import("./pages/ProductionQcTestSheetPage"));
const QualityCheckPage = lazy(() => import("./pages/QualityCheckPage"));
const InProcessTestingListPage = lazy(() => import("./pages/InProcessTestingListPage"));
const OperationLogListPage = lazy(() => import("./pages/OperationLogListPage"));
const RoleManagementPage = lazy(() => import("./pages/RolesAccessPage"));

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

// Land the user on the first thing they can actually open, rather than a
// dashboard they may have no access to. Follows whatever the admin configured,
// so it keeps working as permissions change.
const HOME_FALLBACKS = [
  { module: "production", to: "/production" },
  { module: "dispatch", to: "/dispatch" },
  { module: "purchase_orders", to: "/purchase-orders" },
  { module: "enquiries", to: "/enquiries" },
  { module: "packing", to: "/packing" }
];

function HomeRedirect() {
  const { can, loading } = usePermissions();

  if (loading) return <RouteFallback />;

  if (can("dashboard")) {
    return withSuspense(<DashboardPage />);
  }

  const target = HOME_FALLBACKS.find((item) => can(item.module));
  if (target) return <Navigate to={target.to} replace />;

  return withSuspense(<DashboardPage />);
}

// Route code is only fetched when the route is first opened, so the first visit
// to each page pays a chunk download before it can render anything. Once the
// current page is idle there is nothing to compete with, so the pages the user
// is most likely to open next are pulled into the browser cache in advance —
// navigation then costs nothing. Idle-time only: it never delays the page the
// user is actually looking at, and it is skipped on a metered/slow connection.
const PREFETCH_ROUTES = [
  () => import("./pages/OrderPage"),
  () => import("./pages/ProductionPage"),
  () => import("./pages/EnquiryPage"),
  () => import("./pages/DispatchPage"),
  () => import("./pages/QualityCheckPage")
];

function usePrefetchRoutes(isAuthenticated) {
  useEffect(() => {
    if (!isAuthenticated) return;

    const connection = navigator.connection;
    if (connection?.saveData || /2g/.test(connection?.effectiveType || "")) return;

    const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 1200));
    const handle = idle(() => {
      PREFETCH_ROUTES.forEach((load) => load().catch(() => {}));
    });

    return () => window.cancelIdleCallback?.(handle);
  }, [isAuthenticated]);
}

function App() {
  const { isAuthenticated } = useAuth();
  usePrefetchRoutes(isAuthenticated);

  return (
    <>
      <GlobalNotification />
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : withSuspense(<LoginPage />)} />

        {/* Print routes — no Layout/navbar */}
        <Route element={<ProtectedRoute module="purchase_orders" />}>
          <Route path="/purchase-orders/:id/print" element={withSuspense(<PurchaseOrderPrintPage />)} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRedirect />} />

            <Route element={<ProtectedRoute module="enquiries" />}>
              <Route path="/enquiries" element={withSuspense(<EnquiryPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="enquiries" />}>
              <Route path="/approval" element={withSuspense(<ApprovalPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="payments" />}>
              <Route path="/payments" element={withSuspense(<PaymentsPage />)} />
            </Route>
            <Route element={<ProtectedRoute module="master_data" />}>
              <Route path="/master-data" element={withSuspense(<MasterDataPage />)} />
              <Route path="/dropdown-masters" element={withSuspense(<DropdownMastersPage />)} />
              <Route path="/supplier-data" element={withSuspense(<SupplierMasterPage />)} />
              <Route path="/product-data" element={withSuspense(<ProductMasterPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="users" />}>
              <Route path="/users" element={withSuspense(<UsersPage />)} />
            </Route>

            {/* Editing who can do what is admin-only, enforced again server-side.
                Deliberately not gated on the users module: an admin may grant a
                role access to Users without handing it the permission matrix. */}
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/role-management" element={withSuspense(<RoleManagementPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="orders" />}>
              <Route path="/orders" element={withSuspense(<OrderPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="purchase_orders" />}>
              <Route path="/purchase-orders" element={withSuspense(<PurchaseOrderListPage />)} />
              <Route path="/purchase-orders/new" element={withSuspense(<PurchaseOrderFormPage />)} />
              <Route path="/purchase-orders/:id" element={withSuspense(<PurchaseOrderDetailPage />)} />
              <Route path="/purchase-orders/:id/edit" element={withSuspense(<PurchaseOrderFormPage />)} />
              <Route path="/purchase-orders/:id/pricing" element={withSuspense(<PurchaseOrderPricingPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="grns" level="FULL" />}>
              <Route path="/grns/new" element={withSuspense(<GrnFormPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="grns" />}>
              <Route path="/grns" element={withSuspense(<GrnListPage />)} />
              <Route path="/grns/:id" element={withSuspense(<GrnDetailPage />)} />
            </Route>

            {/* These three read the inventory ledger, not goods receipts —
                split by category (raw material / packing material / finished
                goods) so each team sees only its own stock. */}
            <Route element={<ProtectedRoute module="inventory" />}>
              <Route path="/raw-materials" element={withSuspense(<RawMaterialPage />)} />
              <Route path="/packing-materials" element={withSuspense(<PackingMaterialInventoryPage />)} />
              <Route path="/finished-goods" element={withSuspense(<FinishedGoodsInventoryPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="production" />}>
              <Route path="/quality-check" element={withSuspense(<QualityCheckPage />)} />
              <Route path="/in-process-testing" element={withSuspense(<InProcessTestingListPage />)} />
              <Route path="/operation-log" element={withSuspense(<OperationLogListPage />)} />
              <Route path="/production" element={withSuspense(<ProductionPage />)} />
              <Route path="/production/:id" element={withSuspense(<ProductionOverviewPage />)} />
              <Route path="/production/:id/batch-setup" element={withSuspense(<ProductionBatchSetupPage />)} />
              <Route path="/production/:id/raw-materials" element={withSuspense(<ProductionMaterialStepPage section="rm" stepKey="raw-materials" label="Raw Materials" colLabel="RM Name" />)} />
              <Route path="/production/:id/additives" element={withSuspense(<ProductionMaterialStepPage section="additives" stepKey="additives" label="Additives" colLabel="Additive" />)} />
              <Route path="/production/:id/catalyst" element={withSuspense(<ProductionMaterialStepPage section="catalysts" stepKey="catalyst" label="Catalyst" colLabel="Catalyst" />)} />
              <Route path="/production/:id/equipment" element={withSuspense(<ProductionEquipmentPage />)} />
              <Route path="/production/:id/process-params" element={withSuspense(<ProductionProcessParamsPage />)} />
              <Route path="/production/:id/operation-log" element={withSuspense(<ProductionOperationLogPage />)} />
              <Route path="/production/:id/in-process-testing" element={withSuspense(<ProductionInProcessTestPage />)} />
              <Route path="/production/:id/qc-test-sheet" element={withSuspense(<ProductionQcTestSheetPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="production" />}>
              <Route path="/production/complete/:id" element={withSuspense(<ProductionCompletePage />)} />
            </Route>

            <Route element={<ProtectedRoute module="packing" />}>
              <Route path="/packing" element={withSuspense(<PackingPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="dispatch" />}>
              <Route path="/dispatch" element={withSuspense(<DispatchPage />)} />
            </Route>

            <Route element={<ProtectedRoute module="dispatch" />}>
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
