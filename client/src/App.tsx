/**
 * Main App Component
 * Handles LIFF initialization and routing
 */
import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useStore } from './store/useStore'
import { authApi } from './services/api'
import { liffService } from './services/liff'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ProductSearchLayout from './pages/ProductSearchLayout'
import History from './pages/History'
import Favorites from './pages/Favorites'
import Farmers from './pages/Farmers'
import MyPage from './pages/MyPage'
import Cart from './pages/Cart'
import OrderComplete from './pages/OrderComplete'
import ProductDetail from './pages/ProductDetail'
import FarmerDetail from './pages/FarmerDetail'
import Register from './pages/Register'
import Admin from './pages/Admin'
import ProducerLayout from './components/ProducerLayout'
import ProducerDashboard from './pages/producer/ProducerDashboard'
import ProductForm from './pages/producer/ProductForm'
import ProducerProfile from './pages/producer/ProducerProfile'
import ProducerSchedule from './pages/producer/ProducerSchedule'
import ProducerSales from './pages/producer/ProducerSales'
import Loading from './components/Loading'

import InviteHandler from './components/InviteHandler'
import AdminLogin from '@/pages/AdminLogin'
import AdminRoute from '@/components/AdminRoute'
import Login from '@/pages/Login'
import GuestLanding from '@/pages/guest/GuestLanding'
import LinkAccountGuide from '@/pages/LinkAccountGuide'

// Auth Guard Component
const AuthGuard = ({ children }: { children: JSX.Element }) => {
  const restaurant = useStore(state => state.restaurant)
  const farmer = useStore(state => state.farmer)
  const userRole = useStore(state => state.userRole)
  const lineUserId = useStore(state => state.lineUserId)
  const location = useLocation()

  // Skip auth guard if we are in the invite flow
  // InviteHandler overlay will handle the UI
  if (location.pathname.startsWith('/invite/') || location.search.includes('token=')) {
    return <></>
  }

  // NOTE: If role based routing is needed later, add logic here

  if (!lineUserId) return <Navigate to="/login" replace />

  // If not linked to any account (neither restaurant nor farmer) OR no role assigned
  // This handles cases where state might be partially stale or user unlinked
  if ((!restaurant && !farmer) || !userRole) {
    // Allow access to link-guide and register page
    if (location.pathname === '/link-guide' || location.pathname === '/register') {
      return children
    }
    return <Navigate to="/link-guide" replace />
  }

  // If linked as farmer but trying to access restaurant routes (root)
  // Ideally we should separate routes better, but for now:
  if (!restaurant && farmer) {
    // Redirect to producer dashboard if accessing root
    if (location.pathname === '/' || location.pathname.startsWith('/products')) {
      return <Navigate to="/producer" replace />
    }
  }

  return children
}

function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const restaurant = useStore(state => state.restaurant)
  const lineUserId = useStore(state => state.lineUserId)
  const setRestaurant = useStore(state => state.setRestaurant)
  const setFarmer = useStore(state => state.setFarmer)
  const setUserRole = useStore(state => state.setUserRole)
  const setLineUserId = useStore(state => state.setLineUserId)

  useEffect(() => {
    const path = window.location.pathname;

    // Guest pages do not need LIFF initialization
    if (path.startsWith('/guest')) {
      setLoading(false);
      return;
    }

    // Admin pages do not need LIFF initialization
    if (path.startsWith('/admin')) {
      setLoading(false);
      return;
    }

    // Skip initialization if we are on the invite page
    // BUT we still need to initialize LIFF to get the user ID for linking
    if (path.startsWith('/invite/') || window.location.search.includes('token=')) {
      // InviteHandler will handle initialization
      setLoading(false);
      return;
    }
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      // Initialize LIFF SDK
      await liffService.init()

      // Check if running in LIFF and logged in
      if (liffService.isLoggedIn()) {
        // Get ID Token (SECURE: this will be verified by backend)
        const idToken = liffService.getIDToken()

        if (idToken) {
          // Verify token with backend and get restaurant info
          try {
            const response = await authApi.verify(idToken)
            const { line_user_id, restaurant, farmer, role, is_registered } = response.data

            setLineUserId(line_user_id)
            setUserRole(role as any)

            if (is_registered) {
              if (role === 'restaurant') {
                setRestaurant(restaurant!)
                setFarmer(null)
              }
              if (role === 'farmer') {
                setFarmer(farmer!)
                setRestaurant(null)
              }
            } else {
              console.log('User not registered')
              // User is authenticated with LINE but not registered in our DB
              // Clear state to ensure no stale data persists (Fix for unlinking issue)
              setRestaurant(null)
              setFarmer(null)
              // userRole is already set to null/role by setUserRole above
            }
          } catch (err: any) {
            console.error('Authentication failed:', err)

            // Check if we can fallback to mock data
            if (idToken === 'mock-id-token') {
              console.warn('Backend verification failed for mock token, falling back to local mock data');

              // Set dummy data locally
              const mockLineUserId = 'Uk-id-token'
              setLineUserId(mockLineUserId)

              // For dev purposes, if mock fails, assume new user
              setRestaurant(null)
              setFarmer(null)
            } else {
              setError('認証に失敗しました')
            }
          }
        }
      } else {
        // Not logged in - trigger LINE login
        if (liffService.isInClient()) {
          liffService.login()
          return // Stop execution here to prevent loading state change and redirects
        } else {
          // Allow login in web browser for production/staging
          if (window.location.hostname !== 'localhost') {
            liffService.login()
            return
          }

          // Dev mode logic...
          console.warn('Not in LIFF environment. Using mock data.')
          // ... existing mock logic ...
          try {
            const response = await authApi.verify('mock-id-token')
            const { line_user_id, restaurant, farmer, role, is_registered } = response.data

            setLineUserId(line_user_id)
            setUserRole(role as any)

            if (is_registered) {
              if (role === 'restaurant') setRestaurant(restaurant!)
              if (role === 'farmer') setFarmer(farmer!)
            }
          } catch (e) {
            // Fallback
            setLineUserId('Uk-id-token')
            setRestaurant(null)
          }
        }
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Initialization error:', err)
      setError('アプリの初期化に失敗しました')
      setLoading(false)
    }
  }

  if (loading) {
    return <Loading message="読み込み中..." />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">エラー</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <Router>
        <InviteHandler />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:code" element={<InviteHandler />} />
          <Route path="/link-guide" element={<LinkAccountGuide />} />

          <Route path="/register" element={
            !restaurant && lineUserId ? <Register /> : <Navigate to="/" replace />
          } />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute />}>
            <Route index element={<Admin />} />
          </Route>

          <Route path="/guest" element={<GuestLanding />} />

          <Route path="/" element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }>
            {/* New Routing Structure */}
            <Route index element={<Dashboard />} />
            <Route path="history" element={<History />} />
            <Route path="products" element={<ProductSearchLayout />} />
            <Route path="farmers" element={<Farmers />} />
            <Route path="farmers/:id" element={<FarmerDetail />} />
            <Route path="mypage" element={<MyPage />} />
            {/* Kept for backward compatibility if needed, but navigation points to above */}
            <Route path="favorites" element={<Favorites />} />
          </Route>

          <Route path="/cart" element={
            <AuthGuard>
              <Cart />
            </AuthGuard>
          } />

          <Route path="/products/:id" element={
            <AuthGuard>
              <ProductDetail />
            </AuthGuard>
          } />

          <Route path="/order-complete/:orderId" element={
            <AuthGuard>
              <OrderComplete />
            </AuthGuard>
          } />

          {/* Producer App Routes (Separated) */}
          <Route path="/producer" element={
            <AuthGuard>
              <ProducerLayout />
            </AuthGuard>
          }>
            <Route index element={<ProducerDashboard />} />
            <Route path="profile" element={<ProducerProfile />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id/edit" element={<ProductForm />} />
            <Route path="schedule" element={<ProducerSchedule />} />
            <Route path="sales" element={<ProducerSales />} />
          </Route>
        </Routes>
      </Router>
    </>
  )
}

export default App
