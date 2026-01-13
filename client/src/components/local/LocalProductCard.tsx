import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { Product } from '@/types'

interface LocalProductCardProps {
    product: Product
    onAddToCart: (product: Product, quantity: number) => void
}

const LocalProductCard = ({ product, onAddToCart }: LocalProductCardProps) => {
    const [quantity, setQuantity] = useState(1)

    const increase = () => setQuantity(prev => Math.min(prev + 1, 99))
    const decrease = () => setQuantity(prev => Math.max(prev - 1, 1))

    const handleAdd = () => {
        onAddToCart(product, quantity)
        setQuantity(1)
    }

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
