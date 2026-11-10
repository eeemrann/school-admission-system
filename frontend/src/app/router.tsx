import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "../components/layout/AdminLayout";
import { AppLayout } from "../components/layout/AppLayout";
import { AdminClassesPage } from "../features/admin/pages/AdminClassesPage";
import { AdminClassDetailsPage } from "../features/admin/pages/AdminClassDetailsPage";
import { AdminDashboardPage } from "../features/admin/pages/AdminDashboardPage";
import { LandingPage } from "../features/landing/LandingPage";
import { NotFoundPage } from "../features/not-found/NotFoundPage";
import { StudentApplicationsPage } from "../features/student/pages/StudentApplicationsPage";
import { StudentClassesPage } from "../features/student/pages/StudentClassesPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route element={<LandingPage />} path="/" />
          <Route element={<StudentClassesPage />} path="/student/classes" />
          <Route element={<StudentApplicationsPage />} path="/student/applications" />
          <Route element={<Navigate replace to="/" />} path="/home" />
          <Route element={<NotFoundPage />} path="*" />
        </Route>
        <Route element={<AdminLayout />}>
          <Route element={<AdminDashboardPage />} path="/admin" />
          <Route element={<AdminClassesPage />} path="/admin/classes" />
          <Route element={<AdminClassDetailsPage />} path="/admin/classes/:classId" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
