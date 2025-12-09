/**
 * Vegetable List Page - 野菜一覧
 * Main catalog page showing all products with filters
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productApi } from '@/services/api'
import { StockType } from '@/types'
import Loading from '@/components/Loading'
import ProductCard from '@/components/ProductCard'
import { Search, Filter } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

export default function VegetableList() {
  const [stockTypeFilter, setStockTypeFilter] = useState<StockType | ''>('')
  // const [categoryFilter, setCategoryFilter] = useState<ProductCategory | ''>('')
  const categoryFilter = ''
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', stockTypeFilter, categoryFilter, debouncedSearchQuery],
    queryFn: async () => {
      const params: any = { is_active: 1, limit: 1000 }
      if (stockTypeFilter) params.stock_type = stockTypeFilter
      if (categoryFilter) params.category = categoryFilter
      if (debouncedSearchQuery) params.search = debouncedSearchQuery

      const response = await productApi.list(params)
      return response.data
    },
  })

  if (isLoading) return <Loading message="商品を読み込み中..." />
  if (error) return <div className="p-4 text-red-600 text-center mt-10">エラーが発生しました</div>

  const products = data?.items || []

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Sticky Header with Search */}
      <div className="sticky top-0 z-20 bg-white shadow-sm pb-2">
        <div className="px-4 py-3">
          <h2 className="text-xl font-bold mb-3">野菜一覧</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="商品名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Horizontal Scrollable Filters */}
        <div className="flex overflow-x-auto px-4 pb-2 gap-2 no-scrollbar">
          <button
            onClick={() => setStockTypeFilter('')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${stockTypeFilter === ''
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600'
              }`}
          >
            すべて
          </button>
          <button
            onClick={() => setStockTypeFilter(StockType.KOBE)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${stockTypeFilter === StockType.KOBE
              ? 'bg-green-600 text-white shadow-sm'
              : 'bg-green-50 text-green-700 border border-green-200'
              }`}
          >
            神戸野菜
          </button>
          <button
            onClick={() => setStockTypeFilter(StockType.OTHER)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${stockTypeFilter === StockType.OTHER
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-orange-50 text-orange-700 border border-orange-200'
              }`}
          >
            その他の野菜
          </button>
        </div>
      </div>

      {/* Product Grid */}
      <div className="px-4 py-4">
        {products.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Filter className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>該当する商品が見つかりません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-20">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
