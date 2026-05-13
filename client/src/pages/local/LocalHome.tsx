import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { retailProductApi, farmerApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { RetailProduct } from '@/types'
import { Leaf, Sparkles, Clock, User, AlertCircle } from 'lucide-react'

/** 税込価格を計算 */
const calcTaxIncPrice = (rp: RetailProduct) =>
    Math.round(parseFloat(rp.retail_price) * (1 + rp.tax_rate / 100))

export default function LocalHome() {
    const { consumer } = useStore()
    const navigate = useNavigate()

    // --- Data Fetching ---
    // 訳あり・お買い得商品
    const { data: wakeariData, isLoading: isWakeariLoading, error: wakeariError } = useQuery({
        queryKey: ['local-wakeari-retail-products'],
        queryFn: async () => {
            const response = await retailProductApi.list({ is_wakeari: 1, limit: 6 })
            return response.data
        },
        retry: 2,
        retryDelay: 1000,
    })

    // 旬のおすすめ商品
    const { data: featuredData, isLoading: isFeaturedLoading } = useQuery({
        queryKey: ['local-featured-retail-products'],
        queryFn: async () => {
            const response = await retailProductApi.list({ is_featured: 1, limit: 6 })
            return response.data
        },
        retry: 2,
        retryDelay: 1000,
    })

    // 新着商品
    const { data: newProductsData, isLoading: isNewProductsLoading } = useQuery({
        queryKey: ['local-new-retail-products'],
        queryFn: async () => {
            const response = await retailProductApi.list({ limit: 6 })
            return response.data
        },
        retry: 2,
        retryDelay: 1000,
    })

    // 人気の生産者
    const { data: farmersData, isLoading: isFarmersLoading } = useQuery({
        queryKey: ['local-popular-farmers'],
        queryFn: async () => {
            const response = await farmerApi.list({ is_active: 1, limit: 6 })
            return response.data
        },
        retry: 2,
        retryDelay: 1000,
    })

    const isLoading = isFeaturedLoading || isFarmersLoading || isNewProductsLoading || isWakeariLoading


    if (wakeariError) {
        console.error('API Error:', wakeariError)
    }

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

                {/* エラー表示 */}
                {wakeariError && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-orange-800 mb-1">データの読み込みに失敗しました</p>
                            <p className="text-xs text-orange-700">
                                ネットワーク接続を確認してください。しばらくしてから再度お試しください。
                            </p>
                        </div>
                    </div>
                )}

                {/* 初回ユーザー向けウェルカムカード */}
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                            <User className="text-emerald-600" size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                {consumer?.name ? `${consumer.name}さん` : 'ようこそベジコベへ！'}
                            </h3>
                            {consumer?.name && (
                                <p className="text-sm text-gray-600">ようこそベジコベへ！</p>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-4">
                        神戸の新鮮な野菜を生産者から直接お届け。旬の味をお楽しみください。
                    </p>
                    <button
                        onClick={() => navigate('/local/search')}
                        className="w-full bg-emerald-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-emerald-700 transition-colors"
                    >
                        野菜を探す
                    </button>
                </div>

                {/* 1. 訳あり・お買い得（最優先表示） */}
                {!isWakeariLoading && wakeariData?.items && wakeariData.items.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                                    <Sparkles className="text-orange-500" size={18} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">訳あり・お買い得</h2>
                            </div>
                        </div>

                        <div className="flex overflow-x-auto space-x-3 pb-4 -mx-5 px-5 scrollbar-hide">
                            {wakeariData.items.map((rp: RetailProduct) => (
                                <div
                                    key={rp.id}
                                    onClick={() => navigate(`/local/retail-products/${rp.id}`)}
                                    className="flex-shrink-0 w-36 cursor-pointer active:scale-95 transition-transform"
                                >
                                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                                        {rp.image_url ? (
                                            <img src={rp.image_url} alt={rp.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                                <Leaf className="w-8 h-8 text-gray-300" />
                                            </div>
                                        )}
                                        {/* 訳ありバッジ */}
                                        <div className="absolute top-2 left-2">
                                            <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md">
                                                訳あり
                                            </span>
                                        </div>
                                        {/* グラデーションオーバーレイ */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                                        {/* テキスト情報 */}
                                        <div className="absolute bottom-2 left-2 right-2 text-white">
                                            <p className="font-bold text-sm truncate drop-shadow-md">{rp.name}</p>
                                            <p className="text-xs font-medium opacity-90">¥{calcTaxIncPrice(rp).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 2. 旬のおすすめ食材（横スクロールカルーセル） */}
                {!isFeaturedLoading && featuredData?.items && featuredData.items.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                    <Leaf className="text-green-600" size={18} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">旬のおすすめ食材</h2>
                            </div>
                        </div>

                        <div className="flex overflow-x-auto space-x-3 pb-4 -mx-5 px-5 scrollbar-hide">
                            {featuredData.items.map((rp: RetailProduct) => (
                                <div
                                    key={rp.id}
                                    onClick={() => navigate(`/local/retail-products/${rp.id}`)}
                                    className="flex-shrink-0 w-36 cursor-pointer active:scale-95 transition-transform"
                                >
                                    <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm">
                                        {rp.image_url ? (
                                            <img src={rp.image_url} alt={rp.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                                <Leaf className="w-8 h-8 text-gray-300" />
                                            </div>
                                        )}
                                        {/* グラデーションオーバーレイ */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                                        {/* テキスト情報 */}
                                        <div className="absolute bottom-2 left-2 right-2 text-white">
                                            <p className="font-bold text-sm truncate drop-shadow-md">{rp.name}</p>
                                            <p className="text-xs font-medium opacity-90">¥{calcTaxIncPrice(rp).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 3. 新着アイテム（横スクロール・コンパクト） */}
                {!isNewProductsLoading && newProductsData?.items && newProductsData.items.length > 0 && (
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Clock className="text-blue-600" size={18} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">新着アイテム</h2>
                            </div>
                        </div>

                        <div className="flex overflow-x-auto space-x-6 pb-2 -mx-5 px-5 scrollbar-hide">
                            {newProductsData.items.slice(0, 6).map((rp: RetailProduct) => (
                                <div
                                    key={rp.id}
                                    onClick={() => navigate(`/local/retail-products/${rp.id}`)}
                                    className="flex-shrink-0 flex flex-col items-center space-y-2 cursor-pointer w-20 active:opacity-80 transition-opacity"
                                >
                                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 shadow-sm border border-gray-100">
                                        {rp.image_url ? (
                                            <img src={rp.image_url} alt={rp.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                                <Leaf className="w-6 h-6 text-gray-300" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center w-full">
                                        <p className="font-bold text-sm text-gray-900 truncate w-full">{rp.name}</p>
                                        <p className="text-[10px] text-gray-500">新着</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* 4. 地域の生産者（横スクロール・コンパクト） */}
                {!isFarmersLoading && farmersData?.items && farmersData.items.length > 0 && (
                    <section className="pb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-lg">
                                    👨‍🌾
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">地域の生産者</h2>
                            </div>
                        </div>

                        <div className="flex overflow-x-auto space-x-6 pb-2 -mx-5 px-5 scrollbar-hide">
                            {farmersData.items.map((farmer: any) => (
                                <div
                                    key={farmer.id}
                                    onClick={() => navigate(`/local/farmers/${farmer.id}`)}
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
                                        <p className="text-[10px] text-gray-500 truncate w-full">{farmer.main_crop || '生産者'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ローディング状態 */}
                {isLoading && (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent"></div>
                        <p className="text-sm text-gray-500 mt-3">読み込み中...</p>
                    </div>
                )}

                {/* データがない場合 */}
                {!isLoading &&
                    !wakeariData?.items?.length &&
                    !featuredData?.items?.length &&
                    !newProductsData?.items?.length &&
                    !farmersData?.items?.length && (
                        <div className="bg-gray-50 rounded-2xl p-8 text-center border border-dashed border-gray-200">
                            <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500 font-medium mb-1">商品情報を準備中です</p>
                            <p className="text-xs text-gray-400">しばらくお待ちください</p>
                        </div>
                    )}
            </div>
        </div>
    )
}
