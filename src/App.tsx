import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth, PublicOnly, RequireMfaPending } from './components/routing';
import { CookieBanner } from './components/CookieBanner';
import { AppShell } from './components/AppShell';
import { SuperAdminShell } from './components/SuperAdminShell';

// Landing is kept eager: it's the first thing most visitors see, no need to wait on a chunk for it.
import { Landing } from './pages/Landing';

// Everything else is code-split by route, so a visitor only downloads the module(s) they
// actually navigate to instead of the whole app in one ~1.2MB bundle.
const Pricing = lazy(() => import('./pages/Pricing').then(m => ({ default: m.Pricing })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const MfaChallenge = lazy(() => import('./pages/MfaChallenge').then(m => ({ default: m.MfaChallenge })));
const Signup = lazy(() => import('./pages/Signup').then(m => ({ default: m.Signup })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const LegalPage = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.LegalPage })));

const Dashboard = lazy(() => import('./pages/modules/Dashboard').then(m => ({ default: m.Dashboard })));
const Pipeline = lazy(() => import('./pages/modules/Pipeline').then(m => ({ default: m.Pipeline })));
const Contacts = lazy(() => import('./pages/modules/Contacts').then(m => ({ default: m.Contacts })));
const Companies = lazy(() => import('./pages/modules/Companies').then(m => ({ default: m.Companies })));
const Activities = lazy(() => import('./pages/modules/Activities').then(m => ({ default: m.Activities })));
const Tasks = lazy(() => import('./pages/modules/Tasks').then(m => ({ default: m.Tasks })));
const Calendar = lazy(() => import('./pages/modules/Calendar').then(m => ({ default: m.Calendar })));
const Forecast = lazy(() => import('./pages/modules/Forecast').then(m => ({ default: m.Forecast })));
const Reports = lazy(() => import('./pages/modules/Reports').then(m => ({ default: m.Reports })));
const ImportExport = lazy(() => import('./pages/modules/ImportExport').then(m => ({ default: m.ImportExport })));
const Documents = lazy(() => import('./pages/modules/Documents').then(m => ({ default: m.Documents })));
const Automations = lazy(() => import('./pages/modules/Automations').then(m => ({ default: m.Automations })));
const Notifications = lazy(() => import('./pages/modules/Notifications').then(m => ({ default: m.Notifications })));
const Security = lazy(() => import('./pages/modules/Security').then(m => ({ default: m.Security })));
const Settings = lazy(() => import('./pages/modules/Settings').then(m => ({ default: m.Settings })));
const Billing = lazy(() => import('./pages/modules/Billing').then(m => ({ default: m.Billing })));
const AdminModule = lazy(() => import('./pages/admin/AdminModule').then(m => ({ default: m.AdminModule })));
const Tickets = lazy(() => import('./pages/modules/Tickets').then(m => ({ default: m.Tickets })));
const QuotesInvoices = lazy(() => import('./pages/modules/QuotesInvoices').then(m => ({ default: m.QuotesInvoices })));
const Campaigns = lazy(() => import('./pages/modules/Campaigns').then(m => ({ default: m.Campaigns })));
const KnowledgeBase = lazy(() => import('./pages/modules/KnowledgeBase').then(m => ({ default: m.KnowledgeBase })));
const Privacy = lazy(() => import('./pages/modules/Privacy').then(m => ({ default: m.Privacy })));
const Territories = lazy(() => import('./pages/modules/Territories').then(m => ({ default: m.Territories })));
const PublicKnowledgeBase = lazy(() => import('./pages/PublicKnowledgeBase').then(m => ({ default: m.PublicKnowledgeBase })));

const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const TenantsAdmin = lazy(() => import('./pages/superadmin/TenantsAdmin').then(m => ({ default: m.TenantsAdmin })));
const PlansAdmin = lazy(() => import('./pages/superadmin/PlansAdmin').then(m => ({ default: m.PlansAdmin })));
const CommercialCodes = lazy(() => import('./pages/superadmin/CommercialCodes').then(m => ({ default: m.CommercialCodes })));
const Tracking = lazy(() => import('./pages/superadmin/Tracking').then(m => ({ default: m.Tracking })));
const AuditLogPage = lazy(() => import('./pages/superadmin/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const Announcements = lazy(() => import('./pages/superadmin/Announcements').then(m => ({ default: m.Announcements })));

function Shell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse text-gray-400">Chargement…</div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/privacy" element={<LegalPage type="privacy" />} />
            <Route path="/terms" element={<LegalPage type="terms" />} />
            <Route path="/cgu" element={<LegalPage type="cgu" />} />
            <Route path="/about" element={<LegalPage type="about" />} />
            <Route path="/contact" element={<LegalPage type="contact" />} />
            <Route path="/help/:tenantId" element={<PublicKnowledgeBase />} />
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/mfa-challenge" element={<RequireMfaPending><MfaChallenge /></RequireMfaPending>} />
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
            <Route path="/tickets" element={<RequireAuth><Shell><Tickets /></Shell></RequireAuth>} />
            <Route path="/quotes-invoices" element={<RequireAuth><Shell><QuotesInvoices /></Shell></RequireAuth>} />
            <Route path="/campaigns" element={<RequireAuth><Shell><Campaigns /></Shell></RequireAuth>} />
            <Route path="/knowledge-base" element={<RequireAuth><Shell><KnowledgeBase /></Shell></RequireAuth>} />
            <Route path="/data-privacy" element={<RequireAuth><Shell><Privacy /></Shell></RequireAuth>} />
            <Route path="/territories" element={<RequireAuth><Shell><Territories /></Shell></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><Shell><Notifications /></Shell></RequireAuth>} />
            <Route path="/security" element={<RequireAuth><Shell><Security /></Shell></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Shell><Settings /></Shell></RequireAuth>} />
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
        </Suspense>
        <CookieBanner />
      </HashRouter>
    </AuthProvider>
  );
}
