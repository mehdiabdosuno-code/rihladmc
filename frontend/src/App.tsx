import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useAuthStore } from '@/stores/authStore'

// ── Lazy imports — each page becomes a separate JS chunk ──────────
// Auth
const LoginPage             = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))

// Direction & Stratégie
const DashboardPage         = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const AnalyticsDashboardPage= lazy(() => import('@/pages/AnalyticsDashboardPage').then(m => ({ default: m.AnalyticsDashboardPage })))
const CrmPage               = lazy(() => import('@/pages/CrmPage').then(m => ({ default: m.CrmPage })))

// Cœur de métier DMC
const ProjectsPage          = lazy(() => import('@/pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })))
const ProjectCreatePage     = lazy(() => import('@/pages/ProjectCreatePage').then(m => ({ default: m.ProjectCreatePage })))
const ProjectDetailPage     = lazy(() => import('@/pages/ProjectDetailPageFixed').then(m => ({ default: m.ProjectDetailPage })))
const QuotationsPage        = lazy(() => import('@/pages/QuotationsPage').then(m => ({ default: m.QuotationsPage })))
const ItineraryPage         = lazy(() => import('@/pages/ItineraryPage').then(m => ({ default: m.ItineraryPage })))
const ItineraryTemplatesPage = lazy(() => import('@/pages/ItineraryTemplatesPage').then(m => ({ default: m.ItineraryTemplatesPage })))
const MediaLibraryPage      = lazy(() => import('@/pages/MediaLibraryPage').then(m => ({ default: m.MediaLibraryPage })))

// Opérations Live
const OperationsPage        = lazy(() => import('@/pages/OperationsPage').then(m => ({ default: m.OperationsPage })))
const OperationsCalendarPage= lazy(() => import('@/pages/OperationsCalendarPage').then(m => ({ default: m.OperationsCalendarPage })))
const ConciergePage         = lazy(() => import('@/pages/ConciergePage').then(m => ({ default: m.ConciergePage })))
const QualityPage           = lazy(() => import('@/pages/QualityPage').then(m => ({ default: m.QualityPage })))

// Studio Créatif (IA)
const CircuitGeneratorPage  = lazy(() => import('@/pages/CircuitGeneratorPage').then(m => ({ default: m.CircuitGeneratorPage })))
const ProposalStudioPage    = lazy(() => import('@/pages/ProposalStudioPage').then(m => ({ default: m.ProposalStudioPage })))
const ProposalWriterPage    = lazy(() => import('@/pages/ProposalWriterPage').then(m => ({ default: m.ProposalWriterPage })))
const IntegrationsPage      = lazy(() => import('@/pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })))
const SustainabilityPage    = lazy(() => import('@/pages/SustainabilityPage').then(m => ({ default: m.SustainabilityPage })))
const PaymentAgentPage      = lazy(() => import('@/pages/PaymentAgentPage').then(m => ({ default: m.PaymentAgentPage })))
const PricingCoachPage      = lazy(() => import('@/pages/PricingCoachPage').then(m => ({ default: m.PricingCoachPage })))
const M365HubPage           = lazy(() => import('@/pages/M365HubPage').then(m => ({ default: m.M365HubPage })))
const O2CHubPage            = lazy(() => import('@/pages/O2CHubPage').then(m => ({ default: m.O2CHubPage })))
const P2PHubPage            = lazy(() => import('@/pages/P2PHubPage').then(m => ({ default: m.P2PHubPage })))
const DataHubPage           = lazy(() => import('@/pages/DataHubPage').then(m => ({ default: m.DataHubPage })))
const AgentDesignerPage     = lazy(() => import('@/pages/AgentDesignerPage').then(m => ({ default: m.AgentDesignerPage })))
const CotationAdvancedPage  = lazy(() => import('@/pages/CotationAdvancedPage').then(m => ({ default: m.CotationAdvancedPage })))
const TravelDesignerPage    = lazy(() => import('@/pages/TravelDesignerPage').then(m => ({ default: m.TravelDesignerPage })))
const ActivitiesCatalogPage = lazy(() => import('@/pages/ActivitiesCatalogPage').then(m => ({ default: m.ActivitiesCatalogPage })))
const DocumentTemplatesPage = lazy(() => import('@/pages/DocumentTemplatesPage').then(m => ({ default: m.DocumentTemplatesPage })))
const ContentStudioPage     = lazy(() => import('@/pages/ContentStudioPage').then(m => ({ default: m.ContentStudioPage })))
const AIAssistantPage       = lazy(() => import('@/pages/AIAssistantPage').then(m => ({ default: m.AIAssistantPage })))
const EmailQuotationPage    = lazy(() => import('@/pages/EmailQuotationPage').then(m => ({ default: m.EmailQuotationPage })))

// Logistique & Ressources
const HorizonPortalPage     = lazy(() => import('@/pages/HorizonPortalPage').then(m => ({ default: m.HorizonPortalPage })))
const HotelInventoryPage    = lazy(() => import('@/pages/HotelInventoryPage').then(m => ({ default: m.HotelInventoryPage })))
const GuideManagementPage   = lazy(() => import('@/pages/GuideManagementPage').then(m => ({ default: m.GuideManagementPage })))
const RestaurantInventoryPage = lazy(() => import('@/pages/RestaurantInventoryPage').then(m => ({ default: m.RestaurantInventoryPage })))
const FieldOpsPortal         = lazy(() => import('@/pages/FieldOpsPortal').then(m => ({ default: m.FieldOpsPortal })))
const TransportCommandCenter = lazy(() => import('@/pages/TransportCommandCenter').then(m => ({ default: m.TransportCommandCenter })))
const FinancialStrategyPage  = lazy(() => import('@/pages/FinancialStrategyPage').then(m => ({ default: m.FinancialStrategyPage })))
const FinancialDashboardPage = lazy(() => import('@/pages/FinancialDashboardPage').then(m => ({ default: m.FinancialDashboardPage })))
const RoomingListPage       = lazy(() => import('@/pages/RoomingListPage').then(m => ({ default: m.RoomingListPage })))
const FleetOptimizerPage    = lazy(() => import('@/pages/FleetOptimizerPage').then(m => ({ default: m.FleetOptimizerPage })))

// Gestion & Finance
const BillingPage           = lazy(() => import('@/pages/BillingPage').then(m => ({ default: m.BillingPage })))
const ReportBuilderPage     = lazy(() => import('@/pages/ReportBuilderPage').then(m => ({ default: m.ReportBuilderPage })))
const ReferencesPage        = lazy(() => import('@/pages/ReferencesPage').then(m => ({ default: m.ReferencesPage })))
const ForexDashboardPage    = lazy(() => import('@/pages/ForexDashboardPage').then(m => ({ default: m.ForexDashboardPage })))
const PricingSimulator      = lazy(() => import('@/pages/PricingSimulator').then(m => ({ default: m.PricingSimulator })))
const SettingsPage          = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))

// B2B & Notifications
const ClientPortalPage      = lazy(() => import('@/pages/ClientPortalPage').then(m => ({ default: m.ClientPortalPage })))
const NotificationCenterPage= lazy(() => import('@/pages/NotificationCenterPage').then(m => ({ default: m.NotificationCenterPage })))
const GuidePortalPageLazy   = lazy(() => import('@/pages/GuidePortalPage').then(m => ({ default: m.GuidePortalPage })))
const DriverPortalPageLazy  = lazy(() => import('@/pages/DriverPortalPage').then(m => ({ default: m.DriverPortalPage })))
const ProposalViewPageLazy  = lazy(() => import('@/pages/ProposalViewPage').then(m => ({ default: m.ProposalViewPage })))
const PassengerAppPageLazy = lazy(() => import('./pages/PassengerAppPage').then(m => ({ default: m.PassengerAppPage })))
const CompanionPageLazy    = lazy(() => import('./pages/CompanionPage'))
const OpsCockpitPageLazy   = lazy(() => import('./pages/OpsCockpitPage'))
const SubAgentPortalPageLazy = lazy(() => import('./pages/SubAgentPortalPage'))
const LeaderboardPage       = lazy(() => import('@/pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })))

// ── Skeleton loader shown during page transitions ─────────────────
function PageSkeleton() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '400px',
      flexDirection: 'column',
      gap: '16px',
      opacity: 0.5,
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: 'rgba(255,255,255,0.6)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── QueryClient — performance-optimized defaults ──────────────────
const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx client errors
        if (error?.response?.status >= 400 && error?.response?.status < 500) return false
        return failureCount < 2
      },
      staleTime: 2 * 60_000,          // 2 min — reduce redundant network calls
      gcTime: 10 * 60_000,            // 10 min in-memory cache
      refetchOnWindowFocus: false,     // Avoid refetching on tab switch
      refetchOnReconnect: 'always',    // Always refetch on network recovery
      refetchOnMount: 'always',        // Ensure data freshness on mount
      networkMode: 'offlineFirst',     // Use cache when offline (PWA support)
    },
    mutations: {
      retry: false,
      networkMode: 'online',
    },
  },
})

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    // Validate persisted token on mount — clears stale state if expired
    if (token) fetchMe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <ErrorBoundary>
        <OfflineIndicator />
        <PWAUpdatePrompt />
        <BrowserRouter>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              {/* Public proposal view — no auth required */}
              <Route path="/p/:token" element={<ProposalViewPageLazy />} />
              <Route path="/live/:token" element={<PassengerAppPageLazy />} />
              <Route path="/companion/:token" element={<CompanionPageLazy />} />

              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* DIRECTION & STRATÉGIE */}
                <Route path="/dashboard"             element={<DashboardPage />} />
                <Route path="/analytics"             element={<AnalyticsDashboardPage />} />
                <Route path="/crm"                   element={<CrmPage />} />

                {/* CŒUR DE MÉTIER DMC */}
                <Route path="/projects"              element={<ProjectsPage />} />
                <Route path="/projects/new"          element={<ProjectCreatePage />} />
                <Route path="/projects/:projectId"   element={<ProjectDetailPage />} />
                <Route path="/quotations"            element={<QuotationsPage />} />
                <Route path="/itineraries"           element={<ItineraryPage />} />
                <Route path="/itinerary-templates"   element={<ItineraryTemplatesPage />} />
                <Route path="/media-library"         element={<MediaLibraryPage />} />

                {/* OPÉRATIONS LIVE */}
                <Route path="/operations"            element={<OperationsPage />} />
                <Route path="/operations/calendar"   element={<OperationsCalendarPage />} />
                <Route path="/operations/concierge"  element={<ConciergePage />} />
                <Route path="/quality"               element={<QualityPage />} />

                {/* STUDIO CRÉATIF (IA) */}
                <Route path="/circuit-generator"     element={<CircuitGeneratorPage />} />
                <Route path="/proposal-studio"       element={<ProposalStudioPage />} />
                <Route path="/proposal-writer"       element={<ProposalWriterPage />} />
                <Route path="/integrations"          element={<IntegrationsPage />} />
                <Route path="/sustainability"        element={<SustainabilityPage />} />
                <Route path="/payment-agent"         element={<PaymentAgentPage />} />
                <Route path="/pricing-coach"         element={<PricingCoachPage />} />
                <Route path="/m365"                  element={<M365HubPage />} />
                <Route path="/o2c"                   element={<O2CHubPage />} />
                <Route path="/p2p"                   element={<P2PHubPage />} />
                <Route path="/data-hub"              element={<DataHubPage />} />
                <Route path="/agent-designer"       element={<AgentDesignerPage />} />
                <Route path="/cotation-advanced"     element={<CotationAdvancedPage />} />
                <Route path="/travel-designer"       element={<TravelDesignerPage />} />
                <Route path="/activities"            element={<ActivitiesCatalogPage />} />
                <Route path="/document-templates"    element={<DocumentTemplatesPage />} />
                <Route path="/ai/content-studio"     element={<ContentStudioPage />} />
                <Route path="/ai"                    element={<AIAssistantPage />} />
                <Route path="/email-quotation"       element={<EmailQuotationPage />} />

                {/* LOGISTIQUE & RESSOURCES */}
                <Route path="/portal/horizon"        element={<HorizonPortalPage />} />
                <Route path="/inventory/hotels"      element={<HotelInventoryPage />} />
                <Route path="/inventory/guides"      element={<GuideManagementPage />} />
                <Route path="/inventory/restaurants" element={<RestaurantInventoryPage />} />
                <Route path="/fleet-optimizer"       element={<FleetOptimizerPage />} />

                {/* GESTION & FINANCE */}
                <Route path="/invoices"              element={<BillingPage />} />
                <Route path="/reports"               element={<ReportBuilderPage />} />
                <Route path="/references"            element={<ReferencesPage />} />
                <Route path="/forex"                 element={<ForexDashboardPage />} />
                <Route path="/pricing-simulator"     element={<PricingSimulator />} />
                <Route path="/settings"              element={<SettingsPage />} />

                {/* B2B & NOTIFICATIONS */}
                <Route path="/portal"                element={<ClientPortalPage />} />
                <Route path="/portal/guide"          element={<GuidePortalPageLazy />} />
                <Route path="/portal/driver"         element={<DriverPortalPageLazy />} />
                <Route path="/notifications"         element={<NotificationCenterPage />} />
                
                {/* FIELD OPERATIONS (Drivers/Guides) */}
                <Route path="/field-ops"             element={<FieldOpsPortal />} />
                <Route path="/operations/command-center" element={<TransportCommandCenter />} />
                <Route path="/operations/cockpit"    element={<OpsCockpitPageLazy />} />
                <Route path="/portal"                element={<SubAgentPortalPageLazy />} />
                <Route path="/operations/rooming"    element={<RoomingListPage />} />
                
                {/* FINANCE & STRATEGY */}
                <Route path="/finance/strategy"      element={<FinancialStrategyPage />} />
                <Route path="/finance/p-l"           element={<FinancialDashboardPage />} />
                <Route path="/gamification/leaderboard" element={<LeaderboardPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
