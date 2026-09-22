import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "../layouts/AdminLayout";
import { AuthenticatedLayout } from "../layouts/AuthenticatedLayout";
import { CustomerLayout } from "../layouts/CustomerLayout";
import { ProviderLayout } from "../layouts/ProviderLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { CustomerDashboardPage } from "../pages/CustomerDashboardPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { MarketplaceEquipmentPage } from "../pages/MarketplaceEquipmentPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProviderDashboardPage } from "../pages/ProviderDashboardPage";
import { ProviderJobPage } from "../pages/ProviderJobPage";
import { RegisterPage } from "../pages/RegisterPage";
import { UnauthorizedPage } from "../pages/UnauthorizedPage";
import { ProtectedRoute } from "../routes/ProtectedRoute";
import { RoleProtectedRoute } from "../routes/RoleProtectedRoute";
import { LoadingState } from "../components/ui/LoadingState";

const HomePage = lazy(() => import("../pages/HomePage").then((module) => ({ default: module.HomePage })));
const BookingPage = lazy(() => import("../pages/BookingPage").then((module) => ({ default: module.BookingPage })));
const BookingReviewPage = lazy(() => import("../pages/BookingReviewPage").then((module) => ({ default: module.BookingReviewPage })));
const CustomerWorkspacePage = lazy(() =>
  import("../pages/CustomerWorkspacePage").then((module) => ({ default: module.CustomerWorkspacePage }))
);
const BookingPaymentPage = lazy(() => import("../pages/BookingPaymentPage").then((module) => ({ default: module.BookingPaymentPage })));
const MockPaymentPage = lazy(() => import("../pages/MockPaymentPage").then((module) => ({ default: module.MockPaymentPage })));
const BookingVerificationPage = lazy(() => import("../pages/BookingVerificationPage").then((module) => ({ default: module.BookingVerificationPage })));
const BookingTrackingPage = lazy(() => import("../pages/BookingTrackingPage").then((module) => ({ default: module.BookingTrackingPage })));

export function App() {
  return (
    <Suspense fallback={<LoadingState label="Loading SLAB" />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="customer/login" element={<LoginPage />} />
          <Route path="provider/login" element={<LoginPage providerOnly />} />
          <Route path="admin/login" element={<LoginPage adminOnly />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="customer/register" element={<RegisterPage />} />
          <Route path="provider/register" element={<RegisterPage provider />} />
          <Route path="equipment" element={<MarketplaceEquipmentPage />} />
          <Route path="equipment/:category" element={<MarketplaceEquipmentPage />} />
          <Route path="unauthorized" element={<UnauthorizedPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route element={<RoleProtectedRoute roles={["customer", "admin"]} />}>
            <Route path="booking" element={<BookingPage />} />
              <Route path="booking/review" element={<BookingReviewPage />} />
              <Route path="booking/payment/success" element={<BookingPaymentPage />} />
              <Route path="booking/payment/cancelled" element={<BookingPaymentPage />} />
              <Route path="booking/payment/mock" element={<MockPaymentPage />} />
              <Route path="booking/verify" element={<BookingVerificationPage />} />
              <Route path="booking/tracking" element={<BookingTrackingPage />} />
            </Route>

            <Route element={<RoleProtectedRoute roles={["customer", "admin"]} />}>
              <Route path="customer" element={<CustomerLayout />}>
                <Route index element={<CustomerDashboardPage />} />
                <Route path="workspace" element={<CustomerWorkspacePage />} />
              </Route>
            </Route>

            <Route element={<RoleProtectedRoute roles={["provider"]} />}>
              <Route path="provider" element={<ProviderLayout />}>
                <Route index element={<ProviderDashboardPage />} />
                <Route path="jobs/:bookingId" element={<ProviderJobPage />} />
                <Route path="jobs/:bookingId/chat" element={<ProviderJobPage />} />
              </Route>
            </Route>

            <Route element={<RoleProtectedRoute roles={["admin"]} />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
