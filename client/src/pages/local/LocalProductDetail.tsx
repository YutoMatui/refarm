import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { productApi } from '@/services/api'
import type { Product } from '@/types'
import { useStore } from '@/store/useStore'
import { ArrowLeft, Minus, Plus, Loader2, Salad, User, MapPin, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

const LocalProductDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const addToCart = useStore(state => state.addToCart)
    const cart = useStore(state => state.cart)
    const [product, setProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)
    const [quantity, setQuantity] = useState(1)

    useEffect(() => {
        if (id) {
            loadProduct(parseInt(id))
        }
    }, [id])

    const loadProduct = async (productId: number) => {
        try {
            const res = await productApi.getById(productId)
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
            addToCart(product, quantity)
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

    const cartItem = cart.find(item => item.product.id === product.id)

    return (
        <div className="bg-white min-h-screen pb-24">
            {/* Header Image */}
            <div className="relative aspect-square w-full bg-gray-100">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <Salad size={48} className="mb-2 opacity-50" />
                        <span>画像なし</span>
                    </div>
                )}
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-md hover:bg-white transition-colors"
                >
                    <ArrowLeft size={24} className="text-gray-700" />
                </button>

                {/* 訳ありバッジ */}
                {product.is_wakeari === 1 && (
                    <div className="absolute top-4 right-4">
                        <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                            訳あり
                        </span>
                    </div>
                )}
            </div>

            <div className="p-5 space-y-6">
                {/* Title & Price */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-emerald-600">
                            ¥{Math.round(parseFloat(product.price_with_tax || product.price)).toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500">税込 / {product.unit}</span>
                    </div>
                </div>

                {/* Description */}
                {product.description && (
                    <div className="prose prose-sm text-gray-600">
                        <h3 className="text-sm font-bold text-gray-900 mb-2">商品説明</h3>
                        <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
                            {product.description}
                        </p>
                    </div>
                )}

                {/* Weight Info */}
                {product.weight && (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-sm text-gray-600">
                            重量: <span className="font-bold text-gray-900">{product.weight}g</span>
                        </p>
                    </div>
                )}

                {/* Farmer Info */}
                {product.farmer && (
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-3">
                            <User size={18} className="text-emerald-700" />
                            <h3 className="font-bold text-emerald-900">生産者情報</h3>
                        </div>
                        <Link
                            to={`/local/farmers/${product.farmer.id}`}
                            className="flex items-center justify-between group cursor-pointer hover:bg-emerald-100 p-2 rounded-lg transition-colors -mx-2"
                        >
                            <div className="flex items-center gap-3">
                                {product.farmer.profile_photo_url ? (
                                    <img
                                        src={product.farmer.profile_photo_url}
                                        alt={product.farmer.name}
                                        className="w-12 h-12 rounded-full object-cover border-2 border-emerald-200"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700">
                                        <User size={24} />
                                    </div>
                                )}
                                <div>
                                    <p className="font-bold text-gray-900 group-hover:text-emerald-800">
                                        {product.farmer.name}
                                    </p>
                                    {product.farmer.address && (
                                        <div className="flex items-center gap-1 text-emerald-700 text-xs mt-1">
                                            <MapPin size={12} />
                                            <span>{product.farmer.address}</span>
                                        </div>
                                    )}
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
                            カートに {cartItem.quantity}{product.unit} 入っています
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LocalProductDetail
