import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productApi, orderApi, farmerApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { Product, Order, TaxRate, StockType } from '@/types'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { RotateCcw, Users, ChevronRight, Sparkles, ShoppingBag, Leaf } from 'lucide-react'

export default function Dashboard() {
    const { restaurant, addToCart } = useStore()
    const navigate = useNavigate()

    // --- Data Fetching (Logic remains the same) ---
    const { data: featuredData, isLoading: isFeaturedLoading } = useQuery({
        queryKey: ['featured-products'],
        queryFn: async () => {
            const response = await productApi.list({ is_featured: 1, limit: 6 })
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
            const response = await farmerApi.list({ limit: 5 })
            return response.data
        },
    })

    const isLoading = isFeaturedLoading || isOrderLoading || isFarmersLoading
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
                price_with_tax: String(parseInt(item.unit_price) * (1 + item.tax_rate / 100)),
                is_kobe_veggie: false,
                is_outlet: 0
            }
            addToCart(product, item.quantity)
            addedCount++
        })

        if (addedCount > 0) {
            navigate('/cart')
        }
    }

    if (isLoading) return <Loading message="旬の野菜を探しています..." />

    return (
        <div className="bg-gray-50 min-h-screen pb-24 font-sans">
            {/* Custom Animation Styles */}
            <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-enter { animation: fade-in-up 0.6s ease-out forwards; }
                .animate-delay-100 { animation-delay: 0.1s; }
                .animate-delay-200 { animation-delay: 0.2s; }
                .animate-delay-300 { animation-delay: 0.3s; }
            `}</style>

            {/* --- Hero Section --- */}
            <div className="relative h-72 w-full overflow-hidden rounded-b-[40px] shadow-lg animate-enter">
                {/* Background Image with Overlay */}
                <img
                    src="https://images.unsplash.com/photo-1595855709957-bc0734007f5a?q=80&w=2070&auto=format&fit=crop"
                    alt="Fresh Vegetables"
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-green-900/60 to-green-800/90" />

                {/* Content */}
                <div className="relative h-full flex flex-col items-center justify-center text-center p-6 pt-10">
                    <div className="mb-2 flex items-center justify-center space-x-2 bg-white/20 backdrop-blur-md px-4 py-1 rounded-full text-white text-xs font-bold tracking-wider border border-white/30">
                        <Leaf size={12} fill="currentColor" />
                        <span>KOBE VEGGIE WORKS</span>
                    </div>

                    <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md">
                        ベジコベ
                    </h1>

                    <p className="text-green-50 text-sm font-medium opacity-90 mb-6 max-w-xs mx-auto leading-relaxed whitespace-pre-wrap">
                        {isRepeater
                            ? `${restaurant?.name}様、今日もお疲れ様です。\n旬の食材が入荷しています。`
                            : '神戸の採れたて野菜を、\nお店のキッチンへ直送します。'}
                    </p>
                </div>
            </div>

            {/* --- Main Content Container (Overlapping Hero) --- */}
            <div className="px-4 -mt-16 relative z-10 space-y-6">

                {/* 1. Action Card (Reorder or Guide) */}
                <div className="animate-enter animate-delay-100">
                    {isRepeater && latestOrder ? (
                        <div className="bg-white rounded-2xl p-5 shadow-xl border border-green-50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-green-100 rounded-bl-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2 text-green-700 font-bold">
                                        <RotateCcw size={18} />
                                        <span>いつもの発注</span>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {new Date(latestOrder.created_at).toLocaleDateString('ja-JP')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end mb-4">
                                    <p className="text-sm text-gray-500">前回と同じ内容で<br />素早くオーダーできます</p>
                                    <p className="text-2xl font-bold text-gray-800">
                                        ¥{parseInt(latestOrder.total_amount).toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleReorder(latestOrder)}
                                    className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                                >
                                    <ShoppingBag size={18} />
                                    <span>カートに入れる</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-6 shadow-xl border border-green-50 text-center">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">はじめての方へ</h3>
                            <p className="text-sm text-gray-500 mb-4">まずは一覧から気になる野菜を探してみましょう</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => navigate('/products')}
                                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl shadow hover:bg-green-700 transition-colors"
                                >
                                    野菜を探す
                                </button>
                                <button
                                    onClick={() => navigate('/farmers')}
                                    className="flex-1 bg-white text-green-700 border border-green-200 font-bold py-3 rounded-xl shadow-sm hover:bg-green-50 transition-colors"
                                >
                                    生産者を見る
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Featured Products (Carousel styling) */}
                <section className="animate-enter animate-delay-200">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center">
                            <Sparkles className="w-5 h-5 text-yellow-400 mr-2 fill-current" />
                            <span>今週のおすすめ</span>
                        </h2>
                        <button
                            onClick={() => navigate('/products')}
                            className="text-xs font-bold text-green-600 flex items-center hover:underline"
                        >
                            もっと見る <ChevronRight size={14} />
                        </button>
                    </div>

                    {/* Use a slight negative margin to allow cards to bleed to edge if desired, keeping grid for now */}
                    <div className="grid grid-cols-2 gap-4">
                        {featuredData?.items?.map((product: Product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                    {featuredData?.items?.length === 0 && (
                        <div className="bg-white rounded-xl p-8 text-center border border-dashed border-gray-300">
                            <p className="text-sm text-gray-400">ただいま準備中です</p>
                        </div>
                    )}
                </section>

                {/* 3. Popular Farmers */}
                {!isRepeater && (
                    <section className="animate-enter animate-delay-300 pb-8">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center">
                                <Users className="w-5 h-5 text-blue-500 mr-2" />
                                <span>人気の生産者</span>
                            </h2>
                            <button
                                onClick={() => navigate('/farmers')}
                                className="text-xs font-bold text-green-600 flex items-center hover:underline"
                            >
                                全員見る <ChevronRight size={14} />
                            </button>
                        </div>

                        <div className="flex overflow-x-auto space-x-4 pb-4 px-1 -mx-4 px-4 scrollbar-hide">
                            {farmersData?.items?.map((farmer: any) => (
                                <div
                                    key={farmer.id}
                                    onClick={() => navigate(`/farmers/${farmer.id}`)}
                                    className="flex-shrink-0 w-36 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden active:scale-95 transition-all"
                                >
                                    <div className="h-28 bg-gray-200 relative">
                                        {farmer.profile_photo_url ? (
                                            <img src={farmer.profile_photo_url} alt={farmer.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center">
                                                <Users className="text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <h3 className="font-bold text-sm text-gray-800 truncate">{farmer.name}</h3>
                                        <div className="flex items-center mt-1">
                                            <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full truncate">
                                                {farmer.main_crop || '野菜全般'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}