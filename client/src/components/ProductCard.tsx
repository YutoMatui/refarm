import { Product, StockType } from '@/types'
import { useStore } from '@/store/useStore'
import { Heart, Plus, Minus } from 'lucide-react'
import { useState } from 'react'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart, cart, isFavorite } = useStore()
  const [quantity, setQuantity] = useState(1)
  const cartItem = cart.find(item => item.product.id === product.id)
  const isKobe = product.stock_type === StockType.KOBE

  const handleAddToCart = () => {
    addToCart(product, quantity)
    setQuantity(1)
  }

  return (
    <div className={`card border-2 ${isKobe ? 'border-kobe-500' : 'border-other-500'}`}>
      {/* Badge */}
      <div className="mb-2">
        <span className={isKobe ? 'badge-kobe' : 'badge-other'}>
          {isKobe ? '神戸野菜' : 'その他の野菜'}
        </span>
      </div>

      {/* Product Image */}
      {product.image_url && (
        <img src={product.image_url} alt={product.name} className="w-full h-32 object-cover rounded-md mb-3" />
      )}

      {/* Product Info */}
      <h3 className="font-bold text-lg mb-1">{product.name}</h3>
      <p className="text-2xl font-bold text-gray-900 mb-2">
        ¥{parseFloat(product.price_with_tax).toLocaleString()}
        <span className="text-sm font-normal text-gray-600">/{product.unit}</span>
      </p>

      {/* Quantity Controls */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1 bg-gray-200 rounded hover:bg-gray-300">
          <Minus className="w-4 h-4" />
        </button>
        <span className="px-3 py-1 bg-gray-100 rounded font-medium">{quantity}</span>
        <button onClick={() => setQuantity(quantity + 1)} className="p-1 bg-gray-200 rounded hover:bg-gray-300">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add to Cart Button */}
      <button onClick={handleAddToCart} className="btn-primary w-full">
        カートに追加
      </button>

      {cartItem && (
        <p className="text-xs text-center mt-2 text-gray-600">
          カート内: {cartItem.quantity}{product.unit}
        </p>
      )}
    </div>
  )
}
