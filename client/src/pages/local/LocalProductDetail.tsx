import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { retailProductApi } from '@/services/api'
import type { RetailProduct } from '@/types'
import { useStore } from '@/store/useStore'
import { ArrowLeft, Minus, Plus, Loader2, Salad, User, ChevronRight, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

/** 税込価格を計算 */
const calcTaxIncPrice = (rp: RetailProduct) =>
    Math.round(parseFloat(rp.retail_price) * (1 + rp.tax_rate / 100))

const LocalProductDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const addToRetailCart = useStore(state => state.addToRetailCart)
    const retailCart = useStore(state => state.retailCart)
    const [product, setProduct] = useState<RetailProduct | null>(null)
    const [loading, setLoading] = useState(true)
    const [quantity, setQuantity] = useState(1)
    const [currentImg, setCurrentImg] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (id) {
            loadProduct(parseInt(id))
        }
    }, [id])

    const loadProduct = async (productId: number) => {
        try {
            const res = await retailProductApi.getById(productId)
            setProduct(res.data)
        } catch (e) {
            console.error(e)
            toast.error('商品情報の取得に失敗しました')
            navigate(-1)
        } finally {
            setLoading(false)
        }
    }

    const handleAddToCart = () => {
        if (product) {
            addToRetailCart(product, quantity)
            toast.success(`${product.name} をカートに追加しました`)
            setQuantity(1)
        }
    }

    const increase = () => setQuantity(prev => prev + 1)
    const decrease = () => setQuantity(prev => Math.max(1, prev - 1))

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="animate-spin text-emerald-600" size={40} />
            </div>
        )
    }

    if (!product) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
                <p className="text-gray-600">商品が見つかりません</p>
                <button
                    onClick={() => navigate(-1)}
                    className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg"
                >
                    戻る
                </button>
            </div>
        )
    }

    const cartItem = retailCart.find(item => item.retailProduct.id === product.id)
    const cartItemCount = retailCart.reduce((sum, item) => sum + item.quantity, 0)

    return (
        <div className="bg-white min-h-screen pb-24">
            {/* Image Carousel */}
            {(() => {
                const images = (product.image_urls && product.image_urls.length > 0)
                    ? product.image_urls
                    : (product.image_url ? [product.image_url] : [])

                const handleScroll = () => {
                    if (!scrollRef.current) return
                    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth)
                    setCurrentImg(idx)
                }

                return (
                    <div className="relative w-full bg-gray-100">
                        {images.length > 0 ? (
                            <>
                                <div
                                    ref={scrollRef}
                                    onScroll={handleScroll}
                                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                                    style={{ WebkitOverflowScrolling: 'touch' }}
                                >
                                    {images.map((url, idx) => (
                                        <div key={idx} className="w-full flex-shrink-0 snap-center aspect-square">
                                            <img src={url} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                                {images.length > 1 && (
                                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                                        {images.map((_, idx) => (
                                            <span key={idx} className={`w-2 h-2 rounded-full transition-colors ${idx === currentImg ? 'bg-white' : 'bg-white/40'}`} />
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="aspect-square w-full flex flex-col items-center justify-center text-gray-400">
                                <Salad size={48} className="mb-2 opacity-50" />
                                <span>画像なし</span>
                            </div>
                        )}

                        <button
                            onClick={() => navigate(-1)}
                            className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-md hover:bg-white transition-colors z-10"
                        >
                            <ArrowLeft size={24} className="text-gray-700" />
                        </button>

                        {cartItemCount > 0 && (
                            <button
                                onClick={() => navigate('/local/cart')}
                                className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-md hover:bg-white transition-colors z-10"
                            >
                                <ShoppingCart size={24} className="text-emerald-600" />
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                    {cartItemCount}
                                </span>
                            </button>
                        )}

                        {product.farming_method === 'organic' && (
                            <span className="absolute top-4 left-16 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md z-10">
                                有機
                            </span>
                        )}
                        {product.is_wakeari === 1 && (
                            <div className={`absolute top-4 ${cartItemCount > 0 ? 'right-16' : 'right-4'} z-10`}>
                                <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                                    目玉商品!!
                                </span>
                            </div>
                        )}
                    </div>
                )
            })()}

            <div className="p-5 space-y-6">
                {/* Title & Price */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                        {product.name}
                        {product.retail_quantity_label && (
                            <span className="text-base text-gray-500 ml-2">({product.retail_quantity_label})</span>
                        )}
                    </h1>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-emerald-600">
                            ¥{calcTaxIncPrice(product).toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500">税込 / {product.retail_unit}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">税抜 ¥{parseFloat(product.retail_price).toLocaleString()}</p>
                    {/* 重量・在庫・価格有効期限 */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-2">
                        {product.weight != null && product.weight > 0 && (
                            <span>重量: {product.weight}g</span>
                        )}
                        {product.stock_quantity != null && (
                            <span>在庫: {product.stock_quantity}{product.retail_unit}</span>
                        )}
                        {product.info_confirmed_at && (() => {
                            const confirmed = new Date(product.info_confirmed_at)
                            const now = new Date()
                            const diffDays = Math.max(0, Math.floor((now.getTime() - confirmed.getTime()) / (1000 * 60 * 60 * 24)))
                            const weeksPassed = Math.floor(diffDays / 7)
                            const validUntil = new Date(confirmed.getTime() + (weeksPassed + 1) * 7 * 24 * 60 * 60 * 1000)
                            return <span>{validUntil.getMonth() + 1}/{validUntil.getDate()}までの価格</span>
                        })()}
                    </div>
                </div>

                {/* 目玉商品の説明 */}
                {product.is_wakeari === 1 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                        <p className="text-sm text-red-600 font-medium">規格外品などのためお安く提供しています</p>
                    </div>
                )}

                {/* 2週間以上未更新の警告 */}
                {(() => {
                    const stale = !product.info_confirmed_at ||
                        (new Date().getTime() - new Date(product.info_confirmed_at).getTime()) / (1000 * 60 * 60 * 24) >= 14
                    return stale ? (
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                            <p className="text-sm text-amber-600 font-medium">在庫がなくなっている恐れがございます</p>
                        </div>
                    ) : null
                })()}

                {/* Description */}
                {product.description && (
                    <div className="prose prose-sm text-gray-600">
                        <h3 className="text-sm font-bold text-gray-900 mb-2">商品説明</h3>
                        <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
                            {product.description}
                        </p>
                    </div>
                )}

                {/* Farmer Info (from source_product) */}
                {product.source_product?.farmer_name && product.source_product?.farmer_id && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-3">
                            <User size={18} className="text-emerald-700" />
                            <h3 className="font-bold text-emerald-900">生産者情報</h3>
                        </div>
                        <Link
                            to={`/local/farmers/${product.source_product.farmer_id}`}
                            className="flex items-center justify-between group cursor-pointer hover:bg-emerald-100 p-2 rounded-lg transition-colors -mx-2"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700">
                                    <User size={24} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 group-hover:text-emerald-800">
                                        {product.source_product.farmer_name}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-emerald-400 group-hover:text-emerald-600" />
                        </Link>
                    </div>
                )}
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 shadow-lg z-50">
                <div className="flex gap-4 max-w-md mx-auto">
                    <div className="flex items-center justify-between bg-gray-100 rounded-lg p-1 min-w-[130px]">
                        <button
                            onClick={decrease}
                            className="w-10 h-10 flex items-center justify-center bg-white rounded-md shadow-sm active:bg-gray-50 transition-colors"
                        >
                            <Minus size={18} />
                        </button>
                        <span className="font-bold text-lg w-10 text-center">{quantity}</span>
                        <button
                            onClick={increase}
                            className="w-10 h-10 flex items-center justify-center bg-white rounded-md shadow-sm active:bg-gray-50 transition-colors"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                    <button
                        onClick={handleAddToCart}
                        className="flex-1 bg-emerald-600 text-white font-bold py-3 rounded-lg shadow-md active:bg-emerald-700 transition-colors"
                    >
                        カートに追加
                    </button>
                </div>
                {cartItem && (
                    <div className="text-center mt-2">
                        <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-3 py-1 rounded-full">
                            カートに {cartItem.quantity}{product.retail_unit} 入っています
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LocalProductDetail
