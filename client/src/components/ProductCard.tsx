import { Product, StockType } from '@/types'
import { useStore } from '@/store/useStore'
import { Heart, Plus, Minus, Salad } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { favoriteApi } from '@/services/api'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToCart, cart, restaurant, isFavorite, addFavorite, removeFavorite } = useStore()
  const [quantity, setQuantity] = useState(1)
  const cartItem = cart.find(item => item.product.id === product.id)
  const isKobe = product.stock_type === StockType.KOBE
  const isFav = isFavorite(product.id)

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!restaurant) throw new Error('Restaurant not found')
      const response = await favoriteApi.toggle(restaurant.id, { product_id: product.id })
      return response.data
    },
    onSuccess: (data) => {
      if (data.is_favorited) {
        addFavorite(product.id)
      } else {
        removeFavorite(product.id)
      }
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const handleAddToCart = () => {
    addToCart(product, quantity)
    setQuantity(1)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
      <div className="relative">
        {/* Image */}
        <div
          onClick={() => navigate(`/products/${product.id}`)}
          className="aspect-square w-full bg-gray-100 relative overflow-hidden cursor-pointer active:opacity-90 transition-opacity"
        >
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
              <Salad className="w-12 h-12 mb-2 text-green-200" />
              <span className="text-xs text-gray-400 font-medium">No Photo</span>
            </div>
          )}

          {/* Badge */}
          <div className="absolute top-2 left-2">
            <span className={`px-2 py-1 rounded-md text-xs font-bold text-white shadow-sm ${isKobe ? 'bg-green-600' : 'bg-orange-500'
              }`}>
              {isKobe ? '神戸野菜' : 'その他'}
            </span>
          </div>

          {/* Favorite Button */}
          <button
            onClick={() => toggleFavoriteMutation.mutate()}
            className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm active:scale-95 transition-transform"
          >
            <Heart className={`w-5 h-5 ${isFav ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
          </button>
        </div>
      </div>

      <div className="p-3">
        {/* Title & Price */}
        <div onClick={() => navigate(`/products/${product.id}`)} className="cursor-pointer">
          <h3 className="font-bold text-gray-900 line-clamp-2 min-h-[2.5rem] mb-1 text-sm">
            {product.name}
          </h3>
          <p className="text-xs text-blue-600 mb-2 font-medium">詳細を見る &gt;</p>

          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-lg font-bold text-gray-900">
              ¥{Math.floor(Number(product.price)).toLocaleString()}
            </span>
            <span className="text-xs text-gray-500">
              (税抜) /{product.unit}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Quantity */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 active:bg-gray-100"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-gray-900 w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-gray-600 active:bg-gray-100"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddToCart}
            className="w-full py-2.5 bg-gray-900 text-white text-sm font-bold rounded-lg active:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            カートへ
          </button>
        </div>

        {/* In Cart Indicator */}
        {cartItem && (
          <div className="mt-2 text-center">
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              カートに {cartItem.quantity}{product.unit} 入っています
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
