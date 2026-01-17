import { useState } from 'react'
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
                <div className="w-24 h-24 bg-gray-100 flex-shrink-0">
                    {product.image_url ? (
                        <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs">
                            No Image
                        </div>
                    )}
                </div>
                <div className="flex-1 p-3 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                            <span>{product.stock_type === 'KOBE' ? '🌿 神戸野菜' : '🥬 その他'}</span>
                            {product.is_wakeari === 1 && (
                                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                    訳あり
                                </span>
                            )}
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{product.name}</h3>
                        <p className="text-lg font-bold text-emerald-600 mt-1">
                            ¥{Math.round(parseFloat(product.price_with_tax || product.price)).toLocaleString()}
                            <span className="text-xs text-gray-500 ml-1">/ {product.unit}</span>
                        </p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-1">
                            <button
                                type="button"
                                onClick={decrease}
                                className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                                aria-label="数量を減らす"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
                            <button
                                type="button"
                                onClick={increase}
                                className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                                aria-label="数量を増やす"
                            >
                                <Plus size={14} />
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
            <div className="h-40 bg-gray-100">
                {product.image_url ? (
                    <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
                        No Image
                    </div>
                )}
            </div>
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{product.stock_type === 'KOBE' ? '神戸野菜' : 'その他の野菜'}</span>
                    {product.farmer?.name && <span>生産者: {product.farmer.name}</span>}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xl font-bold text-emerald-600">
                            ¥{Math.round(parseFloat(product.price_with_tax || product.price)).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">税込 / {product.unit}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            type="button"
                            onClick={decrease}
                            className="p-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                            aria-label="数量を減らす"
                        >
                            <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-semibold">{quantity}</span>
                        <button
                            type="button"
                            onClick={increase}
                            className="p-2 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                            aria-label="数量を増やす"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
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
