/**
 * History Page - いつもの
 * 過去の注文履歴から頻繁に注文している商品を表示
 */
import { useQuery } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { type Product } from '@/types'
import Loading from '@/components/Loading'

interface ProductFrequency {
  product: Product
  orderCount: number
  lastOrderDate: string
}

export default function History() {
  const { restaurant } = useStore()

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['restaurant-orders', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return null
      const response = await orderApi.list({ restaurant_id: restaurant.id, limit: 1000 })
      return response.data
    },
    enabled: !!restaurant,
  })

  if (isLoading) return <Loading message="注文履歴を読み込み中..." />

  const orders = ordersData?.items || []

  // 商品ごとの注文頻度を計算
  const productFrequencyMap = new Map<number, ProductFrequency>()

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = productFrequencyMap.get(item.product_id)
      if (existing) {
        existing.orderCount += 1
        if (new Date(order.created_at) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = order.created_at
        }
      } else {
        // Note: In real implementation, fetch product details from product API
        // For now, using product_name from order_items
        productFrequencyMap.set(item.product_id, {
          product: {
            id: item.product_id,
            name: item.product_name,
            price: item.unit_price,
            unit: item.product_unit,
            // Add other required Product fields with defaults
          } as Product,
          orderCount: 1,
          lastOrderDate: order.created_at,
        })
      }
    })
  })

  // Sort by order count (descending)
  const frequentProducts = Array.from(productFrequencyMap.values())
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 20) // Top 20

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-2">いつもの</h2>
      <p className="text-gray-600 mb-6">過去によく注文している商品です</p>

      {frequentProducts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>まだ注文履歴がありません</p>
          <p className="text-sm mt-2">「野菜一覧」から商品を注文してみましょう</p>
        </div>
      ) : (
        <div className="space-y-4">
          {frequentProducts.map((item) => (
            <div
              key={item.product.id}
              className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
            >
              <div className="flex-1">
                <h3 className="font-bold text-lg">{item.product.name}</h3>
                <div className="flex gap-4 mt-2 text-sm text-gray-600">
                  <span>注文回数: {item.orderCount}回</span>
                  <span>
                    最終注文: {new Date(item.lastOrderDate).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">¥{item.product.price}</p>
                <p className="text-sm text-gray-600">/{item.product.unit}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
