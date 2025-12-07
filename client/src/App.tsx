/**
 * Main App Component
 * Handles LIFF initialization and routing
 */
import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { restaurantApi } from './services/api'
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
  const { restaurant, setRestaurant, setLineUserId } = useStore()

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      // Mock LINE User ID for development
      const mockLineUserId = 'U' + Math.random().toString(36).substring(2, 15)
      setLineUserId(mockLineUserId)

      // Try to fetch restaurant by LINE User ID
      try {
        const response = await restaurantApi.getByLineUserId(mockLineUserId)
        setRestaurant(response.data)
      } catch (err: any) {
        if (err.response?.status === 404) {
          // Restaurant not found - would normally redirect to registration
          console.log('Restaurant not registered')
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
