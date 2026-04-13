import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import ApprovalPage from "./pages/ApprovalPage";
import DashboardPage from "./pages/DashboardPage";
import DispatchPage from "./pages/DispatchPage";
import EnquiryPage from "./pages/EnquiryPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import OrderPage from "./pages/OrderPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import ProductionPage from "./pages/ProductionPage";
import ProductionCompletePage from "./pages/ProductionCompletePage";
import UsersPage from "./pages/UsersPage";
import PendingExportDatePage from "./pages/PendingExportDatePage";

const ROLES = {
  ADMIN: "admin",
  SALES: "sales",
  PRODUCTION: "production",
  DISPATCH: "dispatch"
};

const VIEW_ROLES = [ROLES.ADMIN, ROLES.SALES, ROLES.PRODUCTION, ROLES.DISPATCH];

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />

          <Route element={<ProtectedRoute roles={VIEW_ROLES} />}>
            <Route path="/enquiries" element={<EnquiryPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={[ROLES.ADMIN]} />}>
            <Route path="/approval" element={<ApprovalPage />} />
            <Route path="/activity-log" element={<ActivityLogPage />} />
            <Route path="/users" element={<UsersPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={VIEW_ROLES} />}>
            <Route path="/orders" element={<OrderPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={VIEW_ROLES} />}>
            <Route path="/production" element={<ProductionPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.PRODUCTION]} />}>
            <Route path="/production/complete/:id" element={<ProductionCompletePage />} />
          </Route>

          <Route element={<ProtectedRoute roles={VIEW_ROLES} />}>
            <Route path="/dispatch" element={<DispatchPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={[ROLES.ADMIN, ROLES.DISPATCH]} />}>
            <Route path="/pending-export-date" element={<PendingExportDatePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;



