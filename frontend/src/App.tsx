import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import Signup from './components/authenticate/Signup'
import Signin from './components/authenticate/Signin'
import LandingPage from './components/landingPage/landing_page'
import AuctionDetail from './components/auction/auction_detail'
import StartSelling from './components/auction/start_selling'
import LoggedInLandingPage from "./components/landingPage/loggedin_landing_page";
import ProfilePage from './components/profilePage/Profilepage'
import ExploreListingsPage from './components/landingPage/explore_listings_page'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <LoggedInLandingPage /> : <LandingPage />}
      />

      <Route path="/signin" element={<Signin />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/auction" element={<AuctionDetail />} />
      <Route path="/auction/:id" element={<AuctionDetail />} />
      <Route path="/explore/trending" element={<ExploreListingsPage mode="trending" />} />
      <Route path="/explore/ending-soon" element={<ExploreListingsPage mode="ending-soon" />} />
      <Route path="/explore/starting-soon" element={<ExploreListingsPage mode="starting-soon" />} />

      <Route path="/start_selling" element={<StartSelling />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
