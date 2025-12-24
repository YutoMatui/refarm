import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { ArrowRight, Star, TrendingUp, Info } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { productApi, orderApi, farmerApi } from '../services/api'
import ProductCard from '../components/ProductCard'
import Loading from '../components/Loading'

export default function Home() {
  const { restaurant } = useStore()
  const navigate = useNavigate()

  // Check if user has order history
  const { data: orderHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['order-history-check', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return null
      const response = await orderApi.list({ restaurant_id: restaurant.id, limit: 1 })
      return response.data
    },
    enabled: !!restaurant,
  })

  // Recommended Products
  const { data: recommendedProducts, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products-recommended'],
    queryFn: async () => {
      const response = await productApi.list({ is_active: 1, is_featured: 1, limit: 4 })
      return response.data
    }
  })

  // Popular Farmers (for new users)
  const { data: farmers, isLoading: isFarmersLoading } = useQuery({
    queryKey: ['farmers-popular'],
    queryFn: async () => {
      const response = await farmerApi.list({ limit: 3 })
      return response.data
    }
  })

  const isLoading = isHistoryLoading || isProductsLoading || isFarmersLoading
  
  if (isLoading) return <Loading message="読み込み中..." />

  const isNewUser = !orderHistory?.items || orderHistory.items.length === 0

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Header */}
      <div className="bg-green-700 text-white p-6 rounded-b-3xl shadow-md mb-6">
        <h1 className="text-xl font-bold mb-1">
          {restaurant ? `${restaurant.name} 様` : 'ゲスト 様'}
        </h1>
        <p className="text-green-100 text-sm">
          {isNewUser ? 'Refarmへようこそ！' : 'いつもご利用ありがとうございます'}
        </p>
      </div>

      <div className="px-4 space-y-8">
        
        {/* ACTION AREA based on user status */}
        {isNewUser ? (
          // NEW USER: Onboarding
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3 text-orange-500 font-bold">
              <Info size={20} />
              <h2>はじめての方へ</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Refarmは、こだわり農家から直接野菜を仕入れられるアプリです。<br/>
              まずは「さがす」タブから、気になる野菜を見つけてみましょう！
            </p>
            <button 
              onClick={() => navigate('/products')}
              className="w-full bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition-colors shadow-md active:scale-[0.98]"
            >
              野菜を探しにいく <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          // RETURNING USER: Quick Action
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2 text-green-700 font-bold">
                <TrendingUp size={20} />
                <h2>いつもの発注</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                前回と同じ内容で、すぐに発注画面へ進めます。
              </p>
              <button 
                onClick={() => navigate('/history')}
                className="w-full bg-white border-2 border-green-600 text-green-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-green-50 transition-colors active:scale-[0.98]"
              >
                履歴から発注する <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Recommended Section */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Star size={18} className="text-yellow-500 fill-current" />
              今週のおすすめ
            </h2>
            <button 
              onClick={() => navigate('/products')}
              className="text-xs text-green-600 font-bold hover:underline"
            >
              もっと見る
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {recommendedProducts?.items.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>

        {/* Farmers Ranking (Only for new users) */}
        {isNewUser && farmers?.items && farmers.items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-lg font-bold text-gray-800">
                人気の生産者
              </h2>
              <button 
                onClick={() => navigate('/farmers')}
                className="text-xs text-green-600 font-bold hover:underline"
              >
                生産者一覧へ
              </button>
            </div>
            
            <div className="space-y-3">
              {farmers.items.map((farmer, idx) => (
                <div 
                  key={farmer.id}
                  onClick={() => navigate(`/farmers/${farmer.id}`)}
                  className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <img 
                      src={farmer.profile_photo_url || `https://placehold.co/100?text=${farmer.name.charAt(0)}`} 
                      alt={farmer.name}
                      className="w-full h-full object-cover rounded-full border border-gray-100"
                    />
                    <div className="absolute -top-1 -left-1 w-5 h-5 bg-yellow-400 text-white text-xs font-bold flex items-center justify-center rounded-full shadow-sm border border-white">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 truncate">{farmer.name}</h3>
                    <p className="text-xs text-gray-500 truncate">{farmer.main_crop ? `${farmer.main_crop}が自慢` : farmer.address}</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-300" />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
