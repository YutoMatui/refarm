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
import VegetableList from './pages/VegetableList'
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
import Loading from './components/Loading'

// Auth Guard Component
const AuthGuard = ({ children }: { children: JSX.Element }) => {
  const restaurant = useStore(state => state.restaurant)
  const lineUserId = useStore(state => state.lineUserId)

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
  const setLineUserId = useStore(state => state.setLineUserId)

  useEffect(() => {
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
            const { line_user_id, restaurant, is_registered } = response.data

            setLineUserId(line_user_id)

            if (is_registered && restaurant) {
              setRestaurant(restaurant)
            } else {
              console.log('Restaurant not registered')
              // User is authenticated with LINE but not registered in our DB
              // The Router will handle redirection to /register based on state
            }
          } catch (err: any) {
            console.error('Authentication failed:', err)

            // Check if we can fallback to mock data
            if (idToken === 'mock-id-token') {
              console.warn('Backend verification failed for mock token, falling back to local mock data');

              // Set dummy data locally (Use fixed ID to match seed data if user runs it)
              const mockLineUserId = 'Uk-id-token'
              setLineUserId(mockLineUserId)

              // 修正: 初回登録画面の確認のため、強制的に未登録状態とする
              // 開発用デモ店舗データはセットせず、新規ユーザーとして振る舞う
              setRestaurant(null)
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
          // Development mode: use mock data
          console.warn('Not in LIFF environment. Using mock data.')

          // Try to get mock data from backend
          try {
            const response = await authApi.verify('mock-id-token')
            const { line_user_id, restaurant, is_registered } = response.data

            setLineUserId(line_user_id)

            if (is_registered && restaurant) {
              setRestaurant(restaurant)
            }
          } catch (err) {
            console.error('Mock authentication failed:', err)
            // Fallback to local mock if backend fails
            const mockLineUserId = 'Uk-id-token' // Fixed ID to match seed data
            setLineUserId(mockLineUserId)

            // 修正: 初回登録画面の確認のため、強制的に未登録状態とする
            // 開発用デモ店舗データはセットせず、新規ユーザーとして振る舞う
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
        <Routes>
          <Route path="/register" element={
            !restaurant && lineUserId ? <Register /> : <Navigate to="/" replace />
          } />

          <Route path="/" element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }>
            <Route index element={<Navigate to="/catalog" replace />} />
            <Route path="history" element={<History />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="catalog" element={<VegetableList />} />
            <Route path="farmers" element={<Farmers />} />
            <Route path="farmers/:id" element={<FarmerDetail />} />
            <Route path="mypage" element={<MyPage />} />
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
          </Route>

          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Router>
    </>
  )
}

export default App
