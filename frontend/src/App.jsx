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

const ROLES = {
  ADMIN: "admin",
  SALES: "sales",
  PRODUCTION: "production",
  DISPATCH: "dispatch"
};

const ENQUIRY_ROLES = [ROLES.ADMIN, ROLES.SALES];
const ORDER_ROLES = [ROLES.ADMIN, ROLES.SALES];
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

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRedirect />} />

            <Route element={<ProtectedRoute roles={ENQUIRY_ROLES} />}>
              <Route path="/enquiries" element={withSuspense(<EnquiryPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
              <Route path="/approval" element={withSuspense(<ApprovalPage />)} />
              <Route path="/activity-log" element={withSuspense(<ActivityLogPage />)} />
              <Route path="/master-data" element={withSuspense(<MasterDataPage />)} />
              <Route path="/users" element={withSuspense(<UsersPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={ORDER_ROLES} />}>
              <Route path="/orders" element={withSuspense(<OrderPage />)} />
            </Route>

            <Route element={<ProtectedRoute roles={PRODUCTION_ROLES} />}>
              <Route path="/production" element={withSuspense(<ProductionPage />)} />
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
