import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShoppingBag, Eye, EyeOff, Star, Search } from 'lucide-react'
import { productApi } from '@/services/api'
import type { Product } from '@/types'

export default function RetailProductManagement() {
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')

  // 全農家商品を取得（is_active=1のみ）
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'all-products-for-retail'],
    queryFn: async () => {
      const res = await productApi.list({ limit: 1000 })
      return res.data
    },
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const allProducts: Product[] = data?.items || []

  // 消費者向け表示中の商品を上に、それ以外を下に
  const sortedProducts = useMemo(() => {
    let filtered = allProducts
    if (filterText) {
      const q = filterText.toLowerCase()
      filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.farmer?.name || '').toLowerCase().includes(q)
      )
    }
    return [...filtered].sort((a, b) => {
      const aVisible = (a as any).is_consumer_visible || 0
      const bVisible = (b as any).is_consumer_visible || 0
      if (aVisible !== bVisible) return bVisible - aVisible
      return (a.display_order || 0) - (b.display_order || 0)
    })
  }, [allProducts, filterText])

  const visibleCount = allProducts.filter((p: any) => p.is_consumer_visible === 1).length

  // 商品更新 mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => productApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'all-products-for-retail'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '更新に失敗しました'),
  })

  const toggleConsumerVisible = (product: Product) => {
    const current = (product as any).is_consumer_visible || 0
    const newValue = current === 1 ? 0 : 1
    updateMutation.mutate({
      id: product.id,
      data: { is_consumer_visible: newValue },
    })
    toast.success(newValue === 1 ? `「${product.name}」を消費者に表示します` : `「${product.name}」を非表示にしました`)
  }

  const toggleFeatured = (product: Product) => {
    const newValue = product.is_featured === 1 ? 0 : 1
    updateMutation.mutate({
      id: product.id,
      data: { is_featured: newValue },
    })
    toast.success(newValue === 1 ? `「${product.name}」をおすすめに設定` : `「${product.name}」のおすすめを解除`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" />
          小売商品管理
        </h2>
        <div className="text-sm text-gray-500">
          消費者に表示中: <span className="font-bold text-green-600">{visibleCount}</span> / {allProducts.length} 商品
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        農家が登録した商品から、消費者アプリに表示するものを選びます。
        「表示」をONにすると消費者が購入できるようになります。
      </div>

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="商品名・農家名で検索..."
          className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {/* Product Table */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : sortedProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
          商品がありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">商品名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">農家</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">価格</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">単位</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">消費者に表示</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">おすすめ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedProducts.map((product: any) => {
                  const isVisible = product.is_consumer_visible === 1
                  return (
                    <tr key={product.id} className={`hover:bg-gray-50 ${isVisible ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-300 text-xs">
                              N/A
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{product.farmer?.name || '-'}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {Number(product.price).toLocaleString()}円
                      </td>
                      <td className="px-4 py-3 text-gray-600">{product.unit}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleConsumerVisible(product)}
                          disabled={updateMutation.isPending}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                            isVisible
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {isVisible ? <><Eye size={14} /> 表示中</> : <><EyeOff size={14} /> 非表示</>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleFeatured(product)}
                          disabled={updateMutation.isPending}
                          className={`p-1.5 rounded-full transition-colors ${
                            product.is_featured === 1
                              ? 'text-yellow-500 hover:bg-yellow-50'
                              : 'text-gray-300 hover:bg-gray-100 hover:text-gray-400'
                          }`}
                          title={product.is_featured === 1 ? 'おすすめ解除' : 'おすすめに設定'}
                        >
                          <Star size={18} fill={product.is_featured === 1 ? 'currentColor' : 'none'} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
