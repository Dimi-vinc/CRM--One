import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth, PublicOnly } from './components/routing';
import { CookieBanner } from './components/CookieBanner';
import { AppShell } from './components/AppShell';
import { SuperAdminShell } from './components/SuperAdminShell';

import { Landing } from './pages/Landing';
import { Pricing } from './pages/Pricing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Onboarding } from './pages/Onboarding';

import { Dashboard } from './pages/modules/Dashboard';
import { Pipeline } from './pages/modules/Pipeline';
import { Contacts } from './pages/modules/Contacts';
import { Companies } from './pages/modules/Companies';
import { Activities } from './pages/modules/Activities';
import { Tasks } from './pages/modules/Tasks';
import { Calendar } from './pages/modules/Calendar';
import { Forecast } from './pages/modules/Forecast';
import { Reports } from './pages/modules/Reports';
import { ImportExport } from './pages/modules/ImportExport';
import { Documents } from './pages/modules/Documents';
import { Automations } from './pages/modules/Automations';
import { Notifications } from './pages/modules/Notifications';
import { Security } from './pages/modules/Security';
import { Billing } from './pages/modules/Billing';
import { AdminModule } from './pages/admin/AdminModule';

import { SuperAdminDashboard } from './pages/superadmin/SuperAdminDashboard';
import { TenantsAdmin } from './pages/superadmin/TenantsAdmin';
import { PlansAdmin } from './pages/superadmin/PlansAdmin';
import { CommercialCodes } from './pages/superadmin/CommercialCodes';
import { Tracking } from './pages/superadmin/Tracking';
import { AuditLogPage } from './pages/superadmin/AuditLogPage';
import { Announcements } from './pages/superadmin/Announcements';
import { LegalPage } from './pages/LegalPage';

function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/cgu" element={<LegalPage type="cgu" />} />
          <Route path="/about" element={<LegalPage type="about" />} />
          <Route path="/contact" element={<LegalPage type="contact" />} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
          <Route path="/onboarding" element={<RequireAuth requireTenant={false}><Onboarding /></RequireAuth>} />

          {/* App (tenant users) */}
          <Route path="/dashboard" element={<RequireAuth><Shell><Dashboard /></Shell></RequireAuth>} />
          <Route path="/pipeline" element={<RequireAuth><Shell><Pipeline /></Shell></RequireAuth>} />
          <Route path="/contacts" element={<RequireAuth><Shell><Contacts /></Shell></RequireAuth>} />
          <Route path="/companies" element={<RequireAuth><Shell><Companies /></Shell></RequireAuth>} />
          <Route path="/activities" element={<RequireAuth><Shell><Activities /></Shell></RequireAuth>} />
          <Route path="/tasks" element={<RequireAuth><Shell><Tasks /></Shell></RequireAuth>} />
          <Route path="/calendar" element={<RequireAuth><Shell><Calendar /></Shell></RequireAuth>} />
          <Route path="/forecast" element={<RequireAuth><Shell><Forecast /></Shell></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><Shell><Reports /></Shell></RequireAuth>} />
          <Route path="/import_export" element={<RequireAuth><Shell><ImportExport /></Shell></RequireAuth>} />
          <Route path="/documents" element={<RequireAuth><Shell><Documents /></Shell></RequireAuth>} />
          <Route path="/automations" element={<RequireAuth><Shell><Automations /></Shell></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Shell><Notifications /></Shell></RequireAuth>} />
          <Route path="/security" element={<RequireAuth><Shell><Security /></Shell></RequireAuth>} />
          <Route path="/billing" element={<RequireAuth><Shell><Billing /></Shell></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth roles={['admin']}><Shell><AdminModule /></Shell></RequireAuth>} />

          {/* Super Admin (isolated) */}
          <Route path="/super-admin" element={<RequireAuth roles={['super_admin']}><SuperAdminShell><SuperAdminDashboard /></SuperAdminShell></RequireAuth>} />
          <Route path="/super-admin/tenants" element={<RequireAuth roles={['super_admin']}><SuperAdminShell><TenantsAdmin /></SuperAdminShell></RequireAuth>} />
          <Route path="/super-admin/plans" element={<RequireAuth roles={['super_admin']}><SuperAdminShell><PlansAdmin /></SuperAdminShell></RequireAuth>} />
          <Route path="/super-admin/codes" element={<RequireAuth roles={['super_admin']}><SuperAdminShell><CommercialCodes /></SuperAdminShell></RequireAuth>} />
          <Route path="/super-admin/tracking" element={<RequireAuth roles={['super_admin']}><SuperAdminShell><Tracking /></SuperAdminShell></RequireAuth>} />
          <Route path="/super-admin/audit" element={<RequireAuth roles={['super_admin']}><SuperAdminShell><AuditLogPage /></SuperAdminShell></RequireAuth>} />
          <Route path="/super-admin/announcements" element={<RequireAuth roles={['super_admin']}><SuperAdminShell><Announcements /></SuperAdminShell></RequireAuth>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CookieBanner />
      </HashRouter>
    </AuthProvider>
  );
}
