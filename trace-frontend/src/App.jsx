import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { ImpactTreeProvider } from '@/contexts/ImpactTreeContext'
import { PlantProvider } from '@/contexts/PlantContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { WhyDidWeMissPage } from '@/pages/WhyDidWeMissPage'
import { EvidencePage } from '@/pages/EvidencePage'
import { OperationsPage } from '@/pages/OperationsPage'
import { CommercialPage } from '@/pages/CommercialPage'
import { RecurrencePage } from '@/pages/RecurrencePage'
import { RecoverySimulatorPage } from '@/pages/RecoverySimulatorPage'
import { AIInvestigatorPage } from '@/pages/AIInvestigatorPage'
import { ImpactTreePage } from '@/pages/ImpactTreePage'
import { ModelRunnerPage } from '@/pages/ModelRunnerPage'
import { ModelRunnerLivePage } from '@/pages/ModelRunnerLivePage'
import { ModelRunnerResultsPage } from '@/pages/ModelRunnerResultsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <PlantProvider>
            <ImpactTreeProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public routes */}
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />

                  {/* Protected app routes */}
                  <Route
                    element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<OverviewPage />} />
                    <Route path="/why-did-we-miss" element={<WhyDidWeMissPage />} />
                    <Route path="/impact-tree" element={<ImpactTreePage />} />
                    <Route path="/evidence" element={<EvidencePage />} />
                    <Route path="/operations" element={<OperationsPage />} />
                    <Route path="/commercial" element={<CommercialPage />} />
                    <Route path="/recurrence" element={<RecurrencePage />} />
                    <Route path="/simulator" element={<RecoverySimulatorPage />} />
                    <Route path="/ai-investigator" element={<AIInvestigatorPage />} />
                    {/* Model Runner — upload, live pipeline, results */}
                    <Route path="/model-runner" element={<ModelRunnerPage />} />
                    <Route path="/model-runner/live/:analysisId" element={<ModelRunnerLivePage />} />
                    <Route path="/model-runner/results/:analysisId" element={<ModelRunnerResultsPage />} />
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/landing" replace />} />
                </Routes>
              </BrowserRouter>
            </ImpactTreeProvider>
          </PlantProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
