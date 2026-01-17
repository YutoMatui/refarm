import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Sparkles, Clock, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { productApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import LocalProductCard from '@/components/local/LocalProductCard'
import type { Product, PaginatedResponse } from '@/types'

const LocalHome = () => {
    const addToCart = useStore(state => state.addToCart)
    const consumer = useStore(state => state.consumer)
    const cart = useStore(state => state.cart)

    // 訳あり商品を取得
    const { data: wakeariData } = useQuery<PaginatedResponse<Product>>({
        queryKey: ['local-products-wakeari'],
        queryFn: async () => {
            const response = await productApi.list({ is_active: 1, is_wakeari: 1, limit: 10 })
            return response.data as PaginatedResponse<Product>
        },
    })

    // 新着商品を取得（最新順）
    const { data: newData } = useQuery<PaginatedResponse<Product>>({
        queryKey: ['local-products-new'],
        queryFn: async () => {
            const response = await productApi.list({ is_active: 1, limit: 10 })
            return response.data as PaginatedResponse<Product>
        },
    })

    // おすすめ商品を取得
    const { data: featuredData } = useQuery<PaginatedResponse<Product>>({
        queryKey: ['local-products-featured'],
        queryFn: async () => {
            const response = await productApi.list({ is_active: 1, is_featured: 1, limit: 10 })
            return response.data as PaginatedResponse<Product>
        },
    })

    const wakeariProducts = wakeariData?.items ?? []
    const newProducts = newData?.items ?? []
    const featuredProducts = featuredData?.items ?? []

    const handleAddToCart = (product: Product, quantity: number) => {
        addToCart(product, quantity)
        toast.success(`${product.name} をカートに追加しました`)
    }

    const cartCount = cart.reduce((sum, item) => sum + Number(item.quantity), 0)

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-4 py-6 safe-area-pt">
                <div className="max-w-5xl mx-auto space-y-2">
                    <p className="text-xs uppercase tracking-wide opacity-90">Vegicobe Local</p>
                    <h1 className="text-2xl font-bold">{consumer?.name ?? 'お客様'}さん、こんにちは</h1>
                    <p className="text-sm opacity-90">旬の神戸野菜をLINEからかんたん注文</p>
                </div>
            </header>

            {/* メインコンテンツ */}
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
                {/* カートへのショートカット */}
                {cartCount > 0 && (
                    <Link
                        to="/local/cart"
                        className="block bg-emerald-50 border border-emerald-200 rounded-xl p-4 hover:bg-emerald-100 transition"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="bg-emerald-600 text-white rounded-full p-2">
                                    <ShoppingCart size={20} />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">カート {cartCount} 点</p>
                                    <p className="text-sm text-gray-600">タップして注文を確定</p>
                                </div>
                            </div>
                            <div className="text-emerald-600 font-bold text-lg">›</div>
                        </div>
                    </Link>
                )}

                {/* 訳あり・お買い得 */}
                {wakeariProducts.length > 0 && (
                    <section>
                        <div className="flex items-center space-x-2 mb-4">
                            <TrendingUp className="text-orange-500" size={24} />
                            <h2 className="text-lg font-bold text-gray-900">今すぐ買える！訳あり・お買い得</h2>
                        </div>
                        <div className="space-y-3">
                            {wakeariProducts.map((product) => (
                                <LocalProductCard
                                    key={product.id}
                                    product={product}
                                    onAddToCart={handleAddToCart}
                                    compact
                                />
                            ))}
                        </div>
                        <Link
                            to="/local/search?category=wakeari"
                            className="block mt-3 text-center text-sm text-emerald-600 font-semibold py-2"
                        >
                            訳あり商品をもっと見る ›
                        </Link>
                    </section>
                )}

                {/* おすすめ・特集 */}
                {featuredProducts.length > 0 && (
                    <section>
                        <div className="flex items-center space-x-2 mb-4">
                            <Sparkles className="text-yellow-500" size={24} />
                            <h2 className="text-lg font-bold text-gray-900">今週のおすすめ</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {featuredProducts.slice(0, 4).map((product) => (
                                <LocalProductCard
                                    key={product.id}
                                    product={product}
                                    onAddToCart={handleAddToCart}
                                />
                            ))}
                        </div>
                        <Link
                            to="/local/search?featured=1"
                            className="block mt-3 text-center text-sm text-emerald-600 font-semibold py-2"
                        >
                            おすすめ商品をもっと見る ›
                        </Link>
                    </section>
                )}

                {/* 新着・旬の野菜 */}
                {newProducts.length > 0 && (
                    <section>
                        <div className="flex items-center space-x-2 mb-4">
                            <Clock className="text-blue-500" size={24} />
                            <h2 className="text-lg font-bold text-gray-900">新着・旬の野菜</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {newProducts.slice(0, 6).map((product) => (
                                <LocalProductCard
                                    key={product.id}
                                    product={product}
                                    onAddToCart={handleAddToCart}
                                />
                            ))}
                        </div>
                        <Link
                            to="/local/search"
                            className="block mt-3 text-center text-sm text-emerald-600 font-semibold py-2"
                        >
                            すべての商品を見る ›
                        </Link>
                    </section>
                )}

                {/* 商品がない場合 */}
                {wakeariProducts.length === 0 && newProducts.length === 0 && featuredProducts.length === 0 && (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-gray-100">
                        <p className="text-sm">現在ご注文いただける商品がありません。</p>
                        <p className="text-xs mt-2">公開までしばらくお待ちください。</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LocalHome
