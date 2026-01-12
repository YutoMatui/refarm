/**
 * Farmers Page - 農家一覧
 * 契約農家の情報を表示
 */
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { farmerApi } from '@/services/api'
import Loading from '@/components/Loading'
import { ExternalLink, MapPin } from 'lucide-react'

export default function Farmers() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({
    queryKey: ['farmers'],
    queryFn: async () => {
      const response = await farmerApi.list({ is_active: 1, limit: 1000 })
      return response.data
    },
  })

  if (isLoading) return <Loading message="農家情報を読み込み中..." />
  if (error) return <div className="p-4 text-red-600">エラーが発生しました</div>

  const farmers = data?.items || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-2">農家一覧</h2>
      <p className="text-gray-600 mb-6">Refarm契約農家のご紹介</p>

      {farmers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          契約農家の情報がありません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {farmers.map((farmer) => (
            <div key={farmer.id} className="card hover:shadow-lg transition-shadow">
              {/* Profile Photo */}
              {farmer.profile_photo_url ? (
                <img
                  src={farmer.profile_photo_url}
                  alt={farmer.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              ) : (
                <div className="w-full h-48 bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                  <span className="text-gray-400 text-4xl">👨‍🌾</span>
                </div>
              )}

              {/* Farmer Info */}
              <h3 className="text-xl font-bold mb-2">{farmer.name}</h3>

              {farmer.main_crop && (
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">主要作物:</span> {farmer.main_crop}
                </p>
              )}

              {farmer.farming_method && (
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">栽培方法:</span> {farmer.farming_method}
                </p>
              )}

              {farmer.bio && (
                <p className="text-sm text-gray-700 mb-4 line-clamp-3">{farmer.bio}</p>
              )}

              <button
                onClick={() => navigate(`/farmers/${farmer.id}`)}
                className="btn-primary w-full flex items-center justify-center gap-2 mb-2"
              >
                詳細を見る
              </button>

              {/* Map Link - REMOVED */}
              {/*
              {farmer.map_url && (
                <a
                  href={farmer.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  農園MAPを見る
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              */}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
