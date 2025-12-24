import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productApi, orderApi, farmerApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { Product, Order, TaxRate, StockType } from '@/types'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { RotateCcw, Users, ChevronRight, Sparkles } from 'lucide-react'

export default function Dashboard() {
  const { restaurant, addToCart } = useStore()
  const navigate = useNavigate()

  // 1. Fetch Featured Products (Discovery)
  const { data: featuredData, isLoading: isFeaturedLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const response = await productApi.list({ is_featured: 1, limit: 6 })
      return response.data
    },
  })

  // 2. Fetch Latest Order (for Repeater check)
  const { data: latestOrderData, isLoading: isOrderLoading } = useQuery({
    queryKey: ['latest-order', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return null
      const response = await orderApi.list({ restaurant_id: restaurant.id, limit: 1 })
      return response.data
    },
    enabled: !!restaurant,
  })

  // 3. Fetch Popular Farmers (Mock-ish logic: just list active farmers for now)
  const { data: farmersData, isLoading: isFarmersLoading } = useQuery({
    queryKey: ['popular-farmers'],
    queryFn: async () => {
      const response = await farmerApi.list({ limit: 5 })
      return response.data
    },
  })

  const isLoading = isFeaturedLoading || isOrderLoading || isFarmersLoading
  const latestOrder = latestOrderData?.items?.[0]
  const isRepeater = !!latestOrder

  const handleReorder = (order: Order) => {
    let addedCount = 0
    order.items.forEach(item => {
      const product: any = {
        id: item.product_id,
        name: item.product_name,
        price: item.unit_price,
        unit: item.product_unit,
        tax_rate: item.tax_rate === 8 ? TaxRate.REDUCED : TaxRate.STANDARD,
        stock_type: StockType.KOBE,
        price_with_tax: String(parseInt(item.unit_price) * (1 + item.tax_rate / 100)),
        is_kobe_veggie: false,
        is_outlet: 0
      }
      addToCart(product, item.quantity)
      addedCount++
    })

    if (addedCount > 0) {
      navigate('/cart')
    }
  }

  if (isLoading) return <Loading message="読み込み中..." />

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Hero / Welcome Section */}
      <div className="bg-green-700 text-white p-6 rounded-b-3xl shadow-md mb-6">
        <h1 className="text-2xl font-bold mb-2">
          {isRepeater ? `おかえりなさい、${restaurant?.name}様` : 'はじめまして！'}
        </h1>
        <p className="text-green-100 text-sm opacity-90">
          {isRepeater
            ? '今日の美味しい野菜を探しましょう 🥦'
            : 'KOBE Veggie Worksへようこそ。こだわりの神戸野菜をお届けします。'}
        </p>

        {/* Repeater Action: One-tap Reorder */}
        {isRepeater && latestOrder && (
          <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-green-100 flex items-center">
                <RotateCcw size={14} className="mr-1" />
                前回の注文 ({new Date(latestOrder.created_at).toLocaleDateString('ja-JP')})
              </span>
              <span className="text-lg font-bold">¥{parseInt(latestOrder.total_amount).toLocaleString()}</span>
            </div>
            <button
              onClick={() => handleReorder(latestOrder)}
              className="w-full bg-white text-green-800 font-bold py-3 rounded-lg shadow-sm active:scale-[0.98] transition-all flex items-center justify-center"
            >
              前回と同じ内容で発注
            </button>
          </div>
        )}

        {/* New User Action: Guide */}
        {!isRepeater && (
          <div className="mt-6 flex gap-3">
            <button 
                onClick={() => navigate('/products')}
                className="flex-1 bg-white text-green-800 font-bold py-3 rounded-lg shadow-sm active:scale-[0.98] transition-all text-sm"
            >
              野菜を探す
            </button>
            <button 
                onClick={() => navigate('/farmers')}
                className="flex-1 bg-green-800/50 text-white font-bold py-3 rounded-lg shadow-sm active:scale-[0.98] transition-all text-sm border border-green-600"
            >
              生産者を見る
            </button>
          </div>
        )}
      </div>

      <div className="px-4 space-y-8">
        {/* Featured Products */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <Sparkles className="w-5 h-5 text-yellow-500 mr-2" fill="currentColor" />
              今週のおすすめ
            </h2>
            <button 
                onClick={() => navigate('/products')}
                className="text-xs text-green-600 font-bold flex items-center"
            >
                すべて見る <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {featuredData?.items?.map((product: Product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {featuredData?.items?.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">おすすめ商品は現在ありません</p>
          )}
        </section>

        {/* Popular Farmers (Discovery) */}
        {!isRepeater && (
            <section>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Users className="w-5 h-5 text-blue-500 mr-2" />
                人気の生産者
                </h2>
                <button 
                    onClick={() => navigate('/farmers')}
                    className="text-xs text-green-600 font-bold flex items-center"
                >
                    一覧へ <ChevronRight size={14} />
                </button>
            </div>
            
            <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
                {farmersData?.items?.map((farmer: any) => (
                <div 
                    key={farmer.id} 
                    onClick={() => navigate(`/farmers/${farmer.id}`)}
                    className="flex-shrink-0 w-32 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-95 transition-transform"
                >
                    <div className="h-24 bg-gray-200">
                    {farmer.profile_photo_url && (
                        <img src={farmer.profile_photo_url} alt={farmer.name} className="w-full h-full object-cover" />
                    )}
                    </div>
                    <div className="p-3">
                    <h3 className="font-bold text-xs text-gray-800 truncate">{farmer.name}</h3>
                    <p className="text-[10px] text-gray-500 mt-1 truncate">{farmer.main_crop}</p>
                    </div>
                </div>
                ))}
            </div>
            </section>
        )}

        {/* App Info / Guide for new users */}
        {!isRepeater && (
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-2">Refarmの使い方</h3>
                <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2">
                    <li>「さがす」から欲しい野菜を見つける</li>
                    <li>カートに入れて注文を確定</li>
                    <li>指定した日時に店舗へお届け</li>
                </ol>
            </div>
        )}
      </div>
    </div>
  )
}
