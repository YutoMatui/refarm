/**
 * Main App Component
 * Handles LIFF initialization and routing
 */
import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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
import Admin from './pages/Admin'
import Loading from './components/Loading'

function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { setRestaurant, setLineUserId } = useStore()

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
              // In production, redirect to registration page
            }
          } catch (err: any) {
            console.error('Authentication failed:', err)
            setError('認証に失敗しました')
          }
        }
      } else {
        // Not logged in - trigger LINE login
        if (liffService.isInClient()) {
          liffService.login()
        } else {
          // Development mode: use mock data
          console.warn('Not in LIFF environment. Using mock data.')
          const mockLineUserId = 'U' + Math.random().toString(36).substring(2, 15)
          setLineUserId(mockLineUserId)
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
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/catalog" replace />} />
          <Route path="history" element={<History />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="catalog" element={<VegetableList />} />
          <Route path="farmers" element={<Farmers />} />
          <Route path="mypage" element={<MyPage />} />
        </Route>
        <Route path="/cart" element={<Cart />} />
        <Route path="/order-complete/:orderId" element={<OrderComplete />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Router>
  )
}

export default App
