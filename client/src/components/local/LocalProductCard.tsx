import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import type { Product } from '@/types'

interface LocalProductCardProps {
    product: Product
    onAddToCart: (product: Product, quantity: number) => void
    compact?: boolean
}

const LocalProductCard = ({ product, onAddToCart, compact = false }: LocalProductCardProps) => {
    const [quantity, setQuantity] = useState(1)

    const increase = () => setQuantity(prev => Math.min(prev + 1, 99))
    const decrease = () => setQuantity(prev => Math.max(prev - 1, 1))

    const handleAdd = () => {
        onAddToCart(product, quantity)
        setQuantity(1)
    }

    // コンパクト表示（横長リスト）
    if (compact) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex">
                <Link to={`/local/products/${product.id}`} className="w-24 h-24 bg-gray-100 flex-shrink-0">
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                            loading="lazy"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                            No Image
                        </div>
                    )}
                </Link>
                <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                        {product.is_wakeari === 1 && (
                            <div className="mb-1">
                                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                    訳あり
                                </span>
                            </div>
                        )}
                        <Link to={`/local/products/${product.id}`}>
                            <h3 className="text-sm font-bold text-gray-900 line-clamp-1 hover:text-emerald-600 transition-colors">
                                {product.name}
                            </h3>
                        </Link>
                        <p className="text-lg font-bold text-emerald-600 mt-1">
                            ¥{Math.round(parseFloat(product.price_with_tax || product.price)).toLocaleString()}
                            <span className="text-xs text-gray-500 ml-1">/ {product.unit}</span>
                        </p>
                        {product.weight && (
                            <p className="text-xs text-gray-500 mt-0.5">重量: {product.weight}g</p>
                        )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                            <button
                                type="button"
                                onClick={decrease}
                                className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                                aria-label="数量を減らす"
                            >
                                <Minus size={16} />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                            <button
                                type="button"
                                onClick={increase}
                                className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                                aria-label="数量を増やす"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleAdd}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-md transition-colors"
                        >
                            追加
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // 通常表示（グリッド）
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <Link to={`/local/products/${product.id}`} className="block">
                <div className="h-40 bg-gray-100">
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                            loading="lazy"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
                            No Image
                        </div>
                    )}
                </div>
            </Link>
            <div className="p-4 space-y-2">
                {product.is_wakeari === 1 && (
                    <div>
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                            訳あり
                        </span>
                    </div>
                )}
                <Link to={`/local/products/${product.id}`}>
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-emerald-600 transition-colors">
                        {product.name}
                    </h3>
                </Link>
                {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                )}
                <div>
                    <p className="text-xl font-bold text-emerald-600">
                        ¥{Math.round(parseFloat(product.price_with_tax || product.price)).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">税込 / {product.unit}</p>
                    {product.weight && (
                        <p className="text-xs text-gray-500 mt-1">重量: {product.weight}g</p>
                    )}
                </div>
                <div className="flex items-center justify-center space-x-3 py-2">
                    <button
                        type="button"
                        onClick={decrease}
                        className="p-2 rounded-full border-2 border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-emerald-500 transition-colors"
                        aria-label="数量を減らす"
                    >
                        <Minus size={18} />
                    </button>
                    <span className="w-12 text-center text-lg font-semibold">{quantity}</span>
                    <button
                        type="button"
                        onClick={increase}
                        className="p-2 rounded-full border-2 border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-emerald-500 transition-colors"
                        aria-label="数量を増やす"
                    >
                        <Plus size={18} />
                    </button>
                </div>
                <button
                    type="button"
                    onClick={handleAdd}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-md transition-colors"
                >
                    カートに追加
                </button>
            </div>
        </div>
    )
}

export default LocalProductCard
