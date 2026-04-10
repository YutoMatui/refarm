import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productApi, orderApi, farmerApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { Product, Order, TaxRate, StockType } from '@/types'
import Loading from '@/components/Loading'
import { Leaf } from 'lucide-react'
import ProductImageFrame from '@/components/ProductImageFrame'

export default function Dashboard() {
    const { restaurant, addToCart } = useStore()
    const navigate = useNavigate()

    // --- Data Fetching ---
    const { data: featuredData, isLoading: isFeaturedLoading } = useQuery({
        queryKey: ['featured-products'],
        queryFn: async () => {
            const response = await productApi.list({ is_featured: 1, limit: 6 })
            return response.data
        },
    })

    const { data: newProductsData, isLoading: isNewProductsLoading } = useQuery({
        queryKey: ['new-products'],
        queryFn: async () => {
            const response = await productApi.list({ is_active: 1, limit: 6 })
            return response.data
        },
    })

    const { data: latestOrderData, isLoading: isOrderLoading } = useQuery({
        queryKey: ['latest-order', restaurant?.id],
        queryFn: async () => {
            if (!restaurant) return null
            const response = await orderApi.list({ restaurant_id: restaurant.id, limit: 1 })
            return response.data
        },
        enabled: !!restaurant,
    })

    const { data: farmersData, isLoading: isFarmersLoading } = useQuery({
        queryKey: ['popular-farmers'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 6 })
            return response.data
        },
    })

    const isLoading = isFeaturedLoading || isOrderLoading || isFarmersLoading || isNewProductsLoading
    const latestOrder = latestOrderData?.items?.[0]
    const isRepeater = !!latestOrder

    const handleReorder = (order: Order) => {
        let addedCount = 0
        order.items.forEach(item => {
            const product: any = {
                id: item.product_id,
                name: item.product_name,
                price: item.unit_price,
                unit: item.product_unit,
                tax_rate: item.tax_rate === 8 ? TaxRate.REDUCED : TaxRate.STANDARD,
                stock_type: StockType.KOBE,
                price_with_tax: String(parseFloat(String(item.unit_price)) * (1 + item.tax_rate / 100)),
                is_kobe_veggie: false
            }
            addToCart(product, Number(item.quantity))
            addedCount++
        })

        if (addedCount > 0) {
            navigate('/cart')
        }
    }

    // 前回の注文商品名を取得（最大3つ + 残り数）
    const getOrderSummary = (order: Order) => {
        const items = order.items
        if (items.length <= 3) {
            return items.map(item => item.product_name).join(', ')
        }
        const firstThree = items.slice(0, 3).map(item => item.product_name).join(', ')
        return `${firstThree} ほか${items.length - 3}点`
    }

    if (isLoading) return <Loading message="旬の野菜を探しています..." />

    return (
        <div className="bg-white min-h-screen pb-24 font-sans text-gray-800">
            {/* --- Logo Header --- */}
            <div className="flex justify-center pt-8 pb-6">
                <div className="flex flex-col items-center">
                    {/* Logo Circle */}
                    <div className="w-24 h-24 rounded-full border border-gray-100 flex items-center justify-center bg-white shadow-[0_2px_10px_rgba(0,0,0,0.05)] mb-2 overflow-hidden">
                        <img src="/logo.png" alt="ベジコベ ロゴ" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium tracking-wide">KOBE Veggie Ecosystem</p>
                </div>
            </div>

            {/* --- Main Content --- */}
            <div className="px-5 space-y-8">

                {/* 1. いつもの発注カード（リピーター向け） */}
                {isRepeater && latestOrder ? (
                    <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-50">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">いつもの発注（前回の注文）</h3>
                        <div className="mb-4">
                            <div className="text-sm text-gray-600 mb-1">
                                {new Date(latestOrder.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}の注文：
                            </div>
                            <div className="text-sm text-gray-800 font-medium mb-2 line-clamp-2">
                                {getOrderSummary(latestOrder)}
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-gray-900">
                                    ¥{Math.round(parseFloat(String(latestOrder.total_amount))).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => handleReorder(latestOrder)}
                            className="w-full bg-[#4a8a5a] text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-[#3d7a4d] active:scale-[0.98] transition-all flex items-center justify-center text-sm"
                        >
                            この内容で再注文する
                        </button>
                    </div>
                ) : (
                    // 初回ユーザー向け
                    <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 text-center">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">ようこそ、ベジコベへ</h3>
                        <p className="text-sm text-gray-500 mb-4">まずは一覧から気になる野菜を探してみましょう</p>
                        <button
                            onClick={() => navigate('/products')}
                            className="w-full bg-[#4a8a5a] text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-[#3d7a4d] transition-colors"
                        >
                            野菜を探す
                        </button>
                    </div>
                )}

                {/* 2. 旬のおすすめ食材（横スクロールカルーセル） */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">旬のおすすめ食材</h2>
                    </div>

                    <div className="flex overflow-x-auto space-x-3 pb-4 -mx-5 px-5 scrollbar-hide">
                        {featuredData?.items?.map((product: Product) => (
                            <div
                                key={product.id}
                                onClick={() => navigate(`/products/${product.id}`)}
                                className="flex-shrink-0 w-36 cursor-pointer active:scale-95 transition-transform"
                            >
                                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                                    {product.image_url ? (
                                        <ProductImageFrame src={product.image_url} alt={product.name} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                            <Leaf className="w-8 h-8 text-gray-300" />
                                        </div>
                                    )}
                                    {/* グラデーションオーバーレイ */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                                    {/* テキスト情報 */}
                                    <div className="absolute bottom-2 left-2 right-2 text-white">
                                        <p className="font-bold text-sm truncate drop-shadow-md">{product.name}</p>
                                        <p className="text-xs font-medium opacity-90">¥{Math.round(parseFloat(String(product.price_with_tax || product.price))).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {featuredData?.items?.length === 0 && (
                        <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-200">
                            <p className="text-sm text-gray-400">ただいま準備中です</p>
                        </div>
                    )}
                </section>

                {/* 3. 新着アイテム（横スクロール・コンパクト） */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">新着アイテム</h2>
                    </div>

                    <div className="flex overflow-x-auto space-x-6 pb-2 -mx-5 px-5 scrollbar-hide">
                        {newProductsData?.items?.slice(0, 6).map((product: Product) => (
                            <div
                                key={product.id}
                                onClick={() => navigate(`/products/${product.id}`)}
                                className="flex-shrink-0 flex flex-col items-center space-y-2 cursor-pointer w-20 active:opacity-80 transition-opacity"
                            >
                                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 shadow-sm border border-gray-100">
                                    {product.image_url ? (
                                        <ProductImageFrame src={product.image_url} alt={product.name} className="rounded-full" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                            <Leaf className="w-6 h-6 text-gray-300" />
                                        </div>
                                    )}
                                </div>
                                <div className="text-center w-full">
                                    <p className="font-bold text-sm text-gray-900 truncate w-full">{product.name}</p>
                                    <p className="text-[10px] text-gray-500">今日の収穫</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 4. 地域の生産者（横スクロール・コンパクト） */}
                <section className="pb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">地域の生産者</h2>
                    </div>

                    <div className="flex overflow-x-auto space-x-6 pb-2 -mx-5 px-5 scrollbar-hide">
                        {farmersData?.items?.map((farmer: any) => (
                            <div
                                key={farmer.id}
                                onClick={() => navigate(`/farmers/${farmer.id}`)}
                                className="flex-shrink-0 flex flex-col items-center space-y-2 cursor-pointer w-20 active:opacity-80 transition-opacity"
                            >
                                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 shadow-sm border border-gray-100">
                                    {farmer.profile_photo_url ? (
                                        <img src={farmer.profile_photo_url} alt={farmer.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 text-xl">
                                            👨‍🌾
                                        </div>
                                    )}
                                </div>
                                <div className="text-center w-full">
                                    <p className="font-bold text-sm text-gray-900 truncate w-full">{farmer.name}</p>
                                    <p className="text-[10px] text-gray-500 truncate w-full">今日の収穫</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
