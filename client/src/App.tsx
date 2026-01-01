/**
 * Main App Component
 * Handles LIFF initialization and routing
 */
import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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

// Auth Guard Component
const AuthGuard = ({ children }: { children: JSX.Element }) => {
  const restaurant = useStore(state => state.restaurant)
  const lineUserId = useStore(state => state.lineUserId)

  // NOTE: If role based routing is needed later, add logic here

  if (!lineUserId) return <Navigate to="/login" replace />
  if (!restaurant) return <Navigate to="/register" replace />
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
    // Skip initialization if we are on the invite page (it handles its own auth flow partially)
    if (window.location.pathname.startsWith('/invite/')) {
      // Still init liff for the invite page
      liffService.init().then(() => setLoading(false));
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
              if (role === 'restaurant') setRestaurant(restaurant!)
              if (role === 'farmer') setFarmer(farmer!)
            } else {
              console.log('User not registered')
              // User is authenticated with LINE but not registered in our DB
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
        } else {
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

          <Route path="/register" element={
            !restaurant && lineUserId ? <Register /> : <Navigate to="/" replace />
          } />

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
          <Route path="/producer" element={<ProducerLayout />}>
            <Route index element={<ProducerDashboard />} />
            <Route path="profile" element={<ProducerProfile />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id/edit" element={<ProductForm />} />
            <Route path="schedule" element={<ProducerSchedule />} />
            <Route path="sales" element={<ProducerSales />} />
          </Route>

          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
