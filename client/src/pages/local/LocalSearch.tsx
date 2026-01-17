import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Sparkles, Grid3x3, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { productApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import LocalProductCard from '@/components/local/LocalProductCard'
import type { Product, PaginatedResponse } from '@/types'

type TabType = 'featured' | 'all' | 'wakeari'

const LocalSearch = () => {
    const [activeTab, setActiveTab] = useState<TabType>('featured')
    const [keyword, setKeyword] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const addToCart = useStore(state => state.addToCart)

    const tabs = [
        { id: 'featured' as TabType, label: 'おすすめ', icon: Sparkles, color: 'yellow' },
        { id: 'all' as TabType, label: 'すべて', icon: Grid3x3, color: 'emerald' },
        { id: 'wakeari' as TabType, label: '訳あり', icon: TrendingUp, color: 'orange' },
    ]

    // 商品を取得
    const { data, isLoading } = useQuery<PaginatedResponse<Product>>({
        queryKey: ['local-search', activeTab, searchQuery],
        queryFn: async () => {
            const params: any = { is_active: 1, limit: 100 }
            
            if (searchQuery) {
                params.search = searchQuery
            }
            
            if (activeTab === 'featured') {
                params.is_featured = 1
            } else if (activeTab === 'wakeari') {
                params.is_wakeari = 1
            }
            // activeTab === 'all' の場合は特別なフィルターなし
            
            const response = await productApi.list(params)
            return response.data as PaginatedResponse<Product>
        },
    })

    const products = data?.items ?? []

    const handleAddToCart = (product: Product, quantity: number) => {
        addToCart(product, quantity)
        toast.success(`${product.name} をカートに追加しました`)
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setSearchQuery(keyword.trim())
    }

    const handleClearSearch = () => {
        setKeyword('')
        setSearchQuery('')
    }

    return (
        <div className="min-h-screen bg-white pb-24">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-xl font-bold text-gray-900 mb-3">商品をさがす</h1>
                    
                    {/* 検索窓 */}
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="商品名で検索"
                            className="w-full px-4 py-3 pl-11 pr-20 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                        <Search className="absolute left-3.5 top-3.5 text-gray-400" size={20} />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute right-3 top-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                クリア
                            </button>
                        )}
                    </form>
                </div>
            </header>

            {/* タブナビゲーション */}
            <div className="sticky top-[88px] z-10 bg-white border-b border-gray-100 px-4 py-3">
                <div className="max-w-5xl mx-auto flex space-x-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all ${
                                    isActive
                                        ? tab.color === 'yellow'
                                            ? 'bg-yellow-50 border-yellow-400 text-yellow-700 shadow-sm'
                                            : tab.color === 'orange'
                                            ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-sm'
                                            : 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <Icon size={18} />
                                <span className="text-sm font-bold">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 商品リスト */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                {searchQuery && (
                    <div className="mb-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p className="text-sm text-gray-600">
                            「<span className="font-semibold text-gray-900">{searchQuery}</span>」の検索結果
                        </p>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent mb-3"></div>
                        <p className="text-sm text-gray-500">読み込み中...</p>
                    </div>
                ) : products.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-semibold text-gray-700">
                                {products.length} 件の商品
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {products.map((product) => (
                                <LocalProductCard
                                    key={product.id}
                                    product={product}
                                    onAddToCart={handleAddToCart}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                            <Search className="text-gray-300" size={32} />
                        </div>
                        <p className="text-gray-600 font-semibold mb-1">
                            {searchQuery ? '商品が見つかりませんでした' : '商品がありません'}
                        </p>
                        <p className="text-xs text-gray-400 text-center px-8">
                            {searchQuery 
                                ? '別のキーワードやタブでお試しください' 
                                : 'しばらくお待ちください'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LocalSearch
