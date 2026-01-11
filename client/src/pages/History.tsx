/**
 * History Page - いつもの
 * Integrates Order History and Favorites
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orderApi, favoriteApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { Order } from '@/types'
import Loading from '@/components/Loading'
import ProductCard from '@/components/ProductCard'
import { History as HistoryIcon, Heart, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

type TabType = 'history' | 'favorites'

export default function History() {
  const [activeTab, setActiveTab] = useState<TabType>('history')
  const { restaurant, addToCart } = useStore()
  const navigate = useNavigate()

  // 1. Order History Data
  const { data: orderHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['order-history', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return null
      const response = await orderApi.list({ restaurant_id: restaurant.id, limit: 20 })
      return response.data
    },
    enabled: activeTab === 'history' && !!restaurant,
  })

  // 2. Favorites Data
  const { data: favoritesData, isLoading: isFavoritesLoading } = useQuery({
    queryKey: ['favorites', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return null
      const response = await favoriteApi.list(restaurant.id, { limit: 100 })
      return response.data
    },
    enabled: activeTab === 'favorites' && !!restaurant,
  })

  const handleReorder = (order: Order) => {
    let addedCount = 0
    order.items.forEach(item => {
      // Reconstruct minimal product for cart
      // Calculate price_with_tax needed for cart calculation
      const price = parseFloat(item.unit_price);
      const taxRate = Number(item.tax_rate);
      const priceWithTax = price * (1 + taxRate / 100);

      const product: any = {
        id: item.product_id,
        name: item.product_name,
        price: item.unit_price,
        unit: item.product_unit,
        tax_rate: item.tax_rate, // Assuming raw value
        price_with_tax: priceWithTax.toString(),
        // Other fields would be defaults or fetched if needed
        is_active: 1
      }
      addToCart(product, Number(item.quantity))
      addedCount++
    })

    if (addedCount > 0) {
      navigate('/cart')
    }
  }

  const isLoading = isHistoryLoading || isFavoritesLoading

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Sticky Header with Tabs */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history'
              ? 'border-green-600 text-green-700 bg-green-50'
              : 'border-transparent text-gray-500 hover:bg-gray-50'
              }`}
          >
            <HistoryIcon size={18} className="mr-2" />
            注文履歴
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`flex-1 flex items-center justify-center py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'favorites'
              ? 'border-green-600 text-green-700 bg-green-50'
              : 'border-transparent text-gray-500 hover:bg-gray-50'
              }`}
          >
            <Heart size={18} className="mr-2" />
            お気に入り
          </button>
        </div>
      </div>

      <div className="p-4 pb-24">
        {isLoading ? (
          <Loading message="読み込み中..." />
        ) : (
          <>
            {activeTab === 'history' && (
              <div className="space-y-4">
                {(!orderHistoryData?.items || orderHistoryData.items.length === 0) ? (
                  <div className="text-center py-20 text-gray-500">
                    <p>注文履歴がありません</p>
                  </div>
                ) : (
                  orderHistoryData.items.map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-50">
                        <div>
                          <div className="text-xs text-gray-500 mb-0.5">
                            {new Date(order.created_at).toLocaleDateString('ja-JP')}
                          </div>
                          <div className="font-bold text-gray-800">
                            ¥{parseInt(order.total_amount).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReorder(order)}
                            className="bg-green-600 text-white text-xs px-4 py-2 rounded-full font-bold shadow-md active:bg-green-700 flex items-center"
                          >
                            <RotateCcw size={14} className="mr-1" />
                            再注文
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {order.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-gray-800">{item.product_name}</span>
                            <span className="text-gray-500">x{item.quantity} {item.product_unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'favorites' && (
              <>
                {(!favoritesData?.items || favoritesData.items.length === 0) ? (
                  <div className="text-center py-20 text-gray-500">
                    <p>お気に入りがありません</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {favoritesData.items.map(fav => (
                      fav.product && <ProductCard key={fav.product.id} product={fav.product} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
