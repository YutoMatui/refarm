import { Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { History, Heart, List, Users, User, ShoppingCart } from 'lucide-react'

export default function Layout() {
  const navigate = useNavigate()
  const { currentTab, setCurrentTab, getCartItemCount } = useStore()
  const cartCount = getCartItemCount()

  const tabs = [
    { id: 'history' as const, label: 'いつもの', icon: History, path: '/history' },
    { id: 'favorites' as const, label: 'お気に入り', icon: Heart, path: '/favorites' },
    { id: 'catalog' as const, label: '野菜一覧', icon: List, path: '/catalog' },
    { id: 'farmers' as const, label: '農家一覧', icon: Users, path: '/farmers' },
    { id: 'mypage' as const, label: 'マイページ', icon: User, path: '/mypage' },
  ]

  const handleTabClick = (tab: typeof tabs[number]) => {
    setCurrentTab(tab.id)
    navigate(tab.path)
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Refarm EOS</h1>
          <button
            onClick={() => navigate('/cart')}
            className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-7xl mx-auto px-2 py-2">
          <div className="flex justify-around">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = currentTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${isActive ? 'stroke-2' : ''}`} />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
