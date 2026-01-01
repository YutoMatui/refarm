/**
 * Vegetable List Page - 野菜一覧
 * Main catalog page showing all products with filters
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productApi, orderApi } from '@/services/api'
import { StockType, Order, Product, TaxRate } from '@/types'
import Loading from '@/components/Loading'
import ProductCard from '@/components/ProductCard'
import { Search, ShoppingBag, RotateCcw, History as HistoryIcon, List } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

type TabType = 'all' | 'wakeari' | 'history' | 'repeat'

export default function VegetableList() {
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 500)
  const { restaurant, addToCart } = useStore()
  const navigate = useNavigate()

  // 1. 商品一覧 (すべて / 訳あり)
  const { data: productData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', activeTab, debouncedSearchQuery],
    queryFn: async () => {
      const params: any = { is_active: 1, limit: 100 }
      if (debouncedSearchQuery) params.search = debouncedSearchQuery

      if (activeTab === 'wakeari') {
        params.is_wakeari = 1
      }

      const response = await productApi.list(params)
      return response.data
    },
    enabled: activeTab === 'all' || activeTab === 'wakeari',
  })

  // 2. 注文履歴 (いつもの)
  const { data: orderHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['order-history', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return null
      const response = await orderApi.list({ restaurant_id: restaurant.id, limit: 50 })
      return response.data
    },
    enabled: activeTab === 'history' && !!restaurant,
  })

  // 3. 購入済み商品 (リピート)
  const { data: purchasedData, isLoading: isPurchasedLoading } = useQuery({
    queryKey: ['purchased-products', restaurant?.id, debouncedSearchQuery],
    queryFn: async () => {
      if (!restaurant) return null
      const params: any = { limit: 100 }
      if (debouncedSearchQuery) params.search = debouncedSearchQuery
      return await productApi.getPurchased(params)
    },
    enabled: activeTab === 'repeat' && !!restaurant,
  })

  const handleReorder = (order: Order) => {
    let addedCount = 0
    order.items.forEach(item => {
      // 仮のProductオブジェクトを作成してカートに追加
      // 注意: 価格は注文当時のものを使用しているため、本来は最新価格を取得すべき
      const product: any = {
        id: item.product_id,
        name: item.product_name,
        price: item.unit_price,
        unit: item.product_unit,
        tax_rate: item.tax_rate === 8 ? TaxRate.REDUCED : TaxRate.STANDARD,
        stock_type: StockType.KOBE, // Default
        price_with_tax: String(parseInt(item.unit_price) * (1 + item.tax_rate / 100)),
        is_kobe_veggie: false
      }

      addToCart(product, Number(item.quantity))
      addedCount++
    })

    if (addedCount > 0) {
      navigate('/cart')
    }
  }

  // Loading State
  const isLoading = isProductsLoading || isHistoryLoading || isPurchasedLoading

  // Render Content
  const renderContent = () => {
    if (isLoading) return <Loading message="読み込み中..." />

    if (activeTab === 'history') {
      const orders = orderHistoryData?.items || []
      if (orders.length === 0) return <EmptyState message="注文履歴がありません" />

      return (
        <div className="space-y-4 pb-20">
          {orders.map(order => (
            <div key={order.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString('ja-JP')} の注文</div>
                  <div className="font-bold">合計: ¥{parseInt(order.total_amount).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => handleReorder(order)}
                  className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-sm active:bg-green-700"
                >
                  もう一度注文
                </button>
              </div>
              <div className="space-y-2">
                {order.items.map(item => (
                  <div key={item.id} className="text-sm flex justify-between border-b border-gray-50 pb-1 last:border-0">
                    <span>{item.product_name}</span>
                    <span className="text-gray-600">x{item.quantity}{item.product_unit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (activeTab === 'repeat') {
      const products = purchasedData?.items || []
      if (products.length === 0) return <EmptyState message="購入履歴のある商品はありません" />
      return (
        <div className="grid grid-cols-2 gap-3 pb-20">
          {products.map((product: Product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )
    }

    // All or Outlet
    const products = productData?.items || []
    if (products.length === 0) return <EmptyState message="商品が見つかりません" />

    return (
      <div className="grid grid-cols-2 gap-3 pb-20">
        {products.map((product: Product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="商品名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto no-scrollbar">
          <TabButton
            active={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            icon={List}
            label="すべての野菜"
          />
          <TabButton
            active={activeTab === 'wakeari'}
            onClick={() => setActiveTab('wakeari')}
            icon={ShoppingBag}
            label="訳あり野菜"
          />
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            icon={HistoryIcon}
            label="いつもの野菜"
          />
          <TabButton
            active={activeTab === 'repeat'}
            onClick={() => setActiveTab('repeat')}
            icon={RotateCcw}
            label="リピート"
          />
        </div>
      </div>

      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-3 min-w-[80px] border-b-2 transition-colors ${active ? 'border-green-600 text-green-700 bg-green-50' : 'border-transparent text-gray-500 hover:bg-gray-50'
        }`}
    >
      <Icon size={20} className="mb-1" />
      <span className="text-[10px] font-bold whitespace-nowrap">{label}</span>
    </button>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-20 text-gray-500">
      <p>{message}</p>
    </div>
  )
}
