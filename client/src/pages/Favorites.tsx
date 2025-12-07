/**
 * Favorites Page - お気に入り
 * お気に入りに登録した商品を表示
 */
import { useQuery } from '@tanstack/react-query'
import { favoriteApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import ProductCard from '@/components/ProductCard'
import Loading from '@/components/Loading'
import { Heart } from 'lucide-react'

export default function Favorites() {
  const { restaurant } = useStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['favorites', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return null
      const response = await favoriteApi.list(restaurant.id, { limit: 1000 })
      return response.data
    },
    enabled: !!restaurant,
  })

  if (isLoading) return <Loading message="お気に入りを読み込み中..." />
  if (error) return <div className="p-4 text-red-600">エラーが発生しました</div>

  const favorites = data?.items || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Heart className="w-6 h-6 text-red-500 fill-red-500" />
        <h2 className="text-2xl font-bold">お気に入り</h2>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>お気に入りに登録された商品はありません</p>
          <p className="text-sm mt-2">商品カードのハートマークをタップして登録できます</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {favorites.map((favorite) =>
            favorite.product ? (
              <ProductCard key={favorite.product.id} product={favorite.product} />
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
