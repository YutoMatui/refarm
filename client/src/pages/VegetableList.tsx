/**
 * Vegetable List Page - 野菜一覧
 * Main catalog page showing all products with filters
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productApi } from '@/services/api'
import { StockType, ProductCategory } from '@/types'
import Loading from '@/components/Loading'
import ProductCard from '@/components/ProductCard'

export default function VegetableList() {
  const [stockTypeFilter, setStockTypeFilter] = useState<StockType | ''>('')
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | ''>('')
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['products', stockTypeFilter, categoryFilter, searchQuery],
    queryFn: async () => {
      const params: any = { is_active: 1, limit: 1000 }
      if (stockTypeFilter) params.stock_type = stockTypeFilter
      if (categoryFilter) params.category = categoryFilter
      if (searchQuery) params.search = searchQuery
      
      const response = await productApi.list(params)
      return response.data
    },
  })

  if (isLoading) return <Loading message="商品を読み込み中..." />
  if (error) return <div className="p-4 text-red-600">エラーが発生しました</div>

  const products = data?.items || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">野菜一覧</h2>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStockTypeFilter('')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              stockTypeFilter === ''
                ? 'bg-gray-900 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setStockTypeFilter(StockType.KOBE)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              stockTypeFilter === StockType.KOBE
                ? 'bg-kobe-600 text-white'
                : 'bg-kobe-100 text-kobe-700 hover:bg-kobe-200 border-2 border-kobe-500'
            }`}
          >
            神戸野菜
          </button>
          <button
            onClick={() => setStockTypeFilter(StockType.OTHER)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              stockTypeFilter === StockType.OTHER
                ? 'bg-other-600 text-white'
                : 'bg-other-100 text-other-700 hover:bg-other-200 border-2 border-other-500'
            }`}
          >
            その他の野菜
          </button>
        </div>

        <input
          type="text"
          placeholder="商品名で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          該当する商品が見つかりません
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
