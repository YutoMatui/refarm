import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Search, Leaf, Carrot, Apple, Award } from 'lucide-react'
import { toast } from 'sonner'
import { productApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import LocalProductCard from '@/components/local/LocalProductCard'
import type { Product, PaginatedResponse } from '@/types'

const LocalSearch = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const [keyword, setKeyword] = useState(searchParams.get('q') || '')
    const selectedCategory = searchParams.get('category') || 'all'
    const addToCart = useStore(state => state.addToCart)

    const categories = [
        { id: 'all', label: 'すべて', icon: Award },
        { id: 'wakeari', label: '訳あり', icon: Award },
        { id: 'kobe', label: '神戸野菜', icon: Leaf },
        { id: 'other', label: 'その他', icon: Carrot },
        { id: 'fruit', label: '果物', icon: Apple },
    ]

    // 商品を取得
    const { data, isLoading } = useQuery<PaginatedResponse<Product>>({
        queryKey: ['local-search', selectedCategory, keyword],
        queryFn: async () => {
            const params: any = { is_active: 1, limit: 100 }
            
            if (keyword) {
                params.search = keyword
            }
            
            if (selectedCategory === 'wakeari') {
                params.is_wakeari = 1
            } else if (selectedCategory === 'kobe') {
                params.stock_type = 'KOBE'
            } else if (selectedCategory === 'other') {
                params.stock_type = 'OTHER'
            } else if (selectedCategory === 'fruit') {
                params.category = '果物'
            }
            
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
        if (keyword.trim()) {
            setSearchParams({ q: keyword.trim(), category: selectedCategory })
        }
    }

    const handleCategoryChange = (categoryId: string) => {
        setSearchParams({ category: categoryId, ...(keyword ? { q: keyword } : {}) })
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-4 py-4 safe-area-pt">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-xl font-bold text-gray-900 mb-3">商品をさがす</h1>
                    
                    {/* 検索窓 */}
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="商品名で検索"
                            className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                    </form>
                </div>
            </header>

            {/* カテゴリボタン */}
            <div className="bg-white border-b border-gray-100 px-4 py-3">
                <div className="max-w-5xl mx-auto flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map((category) => {
                        const Icon = category.icon
                        const isActive = selectedCategory === category.id
                        return (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => handleCategoryChange(category.id)}
                                className={`flex-shrink-0 flex flex-col items-center justify-center space-y-1 px-4 py-2 rounded-lg border transition ${
                                    isActive
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <Icon size={20} />
                                <span className="text-xs font-semibold whitespace-nowrap">{category.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 商品リスト */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                {isLoading ? (
                    <div className="text-center py-10 text-gray-500">
                        読み込み中...
                    </div>
                ) : products.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-600">{products.length} 件の商品</p>
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
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-gray-100">
                        <p className="text-sm">該当する商品が見つかりませんでした。</p>
                        <p className="text-xs mt-2">別のカテゴリや検索ワードをお試しください。</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LocalSearch
