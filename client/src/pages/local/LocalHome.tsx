import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Leaf, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { productApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import LocalProductCard from '@/components/local/LocalProductCard'
import type { Product, PaginatedResponse } from '@/types'

const LocalHome = () => {
    const addToCart = useStore(state => state.addToCart)
    const cart = useStore(state => state.cart)
    const consumer = useStore(state => state.consumer)

    const { data, isLoading, isError } = useQuery<PaginatedResponse<Product>>({
        queryKey: ['local-products'],
        queryFn: async () => {
            const response = await productApi.list({ is_active: 1, limit: 100 })
            return response.data as PaginatedResponse<Product>
        },
    })

    const products: Product[] = useMemo(() => data?.items ?? [], [data])

    const handleAddToCart = (product: Product, quantity: number) => {
        addToCart(product, quantity)
        toast.success(`${product.name} をカートに追加しました`)
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            <section className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start space-x-4">
                    <div className="p-3 bg-emerald-50 rounded-full text-emerald-600">
                        <Leaf size={24} />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-emerald-600 font-medium">HYOGO VEGETABLES</p>
                        <h2 className="text-2xl font-bold text-gray-900">{consumer?.name ?? 'お客様'}、ようこそベジコベへ</h2>
                        <p className="text-sm text-gray-600">
                            旬の神戸野菜や市場野菜をLINEからかんたん注文。カートに追加して「自宅配送」または「兵庫県立大学 正門受取」をお選びください。
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="rounded-xl border border-gray-200 p-4 flex items-start space-x-3">
                                <div className="text-emerald-600 font-semibold">1</div>
                                <div>
                                    <p className="font-semibold text-gray-900">商品を選ぶ</p>
                                    <p className="text-sm text-gray-600">リストからお好きな野菜を選んでカートに追加します。</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-200 p-4 flex items-start space-x-3">
                                <div className="text-emerald-600 font-semibold">2</div>
                                <div>
                                    <p className="font-semibold text-gray-900">受取方法を選ぶ</p>
                                    <p className="text-sm text-gray-600">自宅配送（送料400円）または大学受取（無料）からお選びください。</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 pt-3">
                            <span className="inline-flex items-center space-x-2 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-sm">
                                <span className="font-semibold">自宅配送</span>
                                <span>送料400円 / 配送枠から選択</span>
                            </span>
                            <span className="inline-flex items-center space-x-2 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm">
                                <span className="font-semibold">大学受取</span>
                                <span>無料 / 正門で受け渡し</span>
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start space-x-3">
                <div className="mt-1 text-emerald-600">
                    <MapPin size={20} />
                </div>
                <div className="text-sm text-emerald-900">
                    <p className="font-semibold">お受取枠について</p>
                    <p>
                        管理者が公開している日時枠のみ選択できます。自宅配送は時間帯（例: 14:00〜16:00）、大学受取は指定時刻（例: 12:15）をご用意しています。
                    </p>
                </div>
            </section>

            {isLoading && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center text-gray-500">
                    商品を読み込み中です...
                </div>
            )}

            {isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">
                    商品情報の取得に失敗しました。時間をおいて再度お試しください。
                </div>
            )}

            {!isLoading && !isError && products.length === 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center text-gray-500">
                    現在ご注文いただける商品がありません。公開までしばらくお待ちください。
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                    <LocalProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
                ))}
            </div>

            {cart.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-sm text-gray-600">カートに {cart.reduce((sum, item) => sum + Number(item.quantity), 0)} 点入っています。</p>
                    </div>
                    <Link
                        to="/local/cart"
                        className="inline-flex items-center justify-center px-5 py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700"
                    >
                        カートを確認する
                    </Link>
                </div>
            )}
        </div>
    )
}

export default LocalHome
