import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { useAuth } from './auth/useAuth'
import { ApiOfflineBanner } from './components/ApiOfflineBanner'

const LandingPage = lazy(() => import('./components/landingPage/landing_page'))
const LoggedInLandingPage = lazy(() => import('./components/landingPage/loggedin_landing_page'))
const Signin = lazy(() => import('./components/authenticate/Signin'))
const Signup = lazy(() => import('./components/authenticate/Signup'))
const ProfilePage = lazy(() => import('./components/profilePage/ProfilePage'))
const AuctionDetail = lazy(() => import('./components/auction/auction_detail'))
const StartSelling = lazy(() => import('./components/auction/start_selling'))
const ExploreListingsPage = lazy(() => import('./components/landingPage/explore_listings_page'))

function PageLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        color: 'var(--color-text-muted, #64748b)',
        fontSize: '0.95rem',
      }}
    >
      Loading…
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/*
          Public: /, /signin, /signup, /auction, /auction/:id, /explore/*
          Protected: /profile, /start_selling (via ProtectedRoute → /signin?state.from)
        */}
        <Route
          path="/"
          element={isAuthenticated ? <LoggedInLandingPage /> : <LandingPage />}
        />

        <Route path="/signin" element={<Signin />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/auction" element={<AuctionDetail />} />
        <Route path="/auction/:id" element={<AuctionDetail />} />
        <Route path="/explore/trending" element={<ExploreListingsPage mode="trending" />} />
        <Route path="/explore/ending-soon" element={<ExploreListingsPage mode="ending-soon" />} />
        <Route path="/explore/starting-soon" element={<ExploreListingsPage mode="starting-soon" />} />

        <Route
          path="/start_selling"
          element={
            <ProtectedRoute>
              <StartSelling />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-listing/:id"
          element={
            <ProtectedRoute>
              <StartSelling />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ApiOfflineBanner />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
