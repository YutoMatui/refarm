import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { farmerApi } from '@/services/api'
import Loading from '@/components/Loading'

const LocalFarmers = () => {
    const navigate = useNavigate()

    const { data, isLoading, error } = useQuery({
        queryKey: ['local-farmers'],
        queryFn: async () => {
            const response = await farmerApi.list({ is_active: 1, limit: 1000 })
            return response.data
        },
    })

    if (isLoading) return <Loading message="生産者情報を読み込み中..." />

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center">
                    <p className="text-red-600">エラーが発生しました</p>
                </div>
            </div>
        )
    }

    const farmers = data?.items || []

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-4 py-4 safe-area-pt">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-xl font-bold text-gray-900">生産者さん</h1>
                    <p className="text-sm text-gray-600 mt-1">顔が見える、安心のRefarm契約農家</p>
                </div>
            </header>

            {/* 生産者リスト */}
            <div className="max-w-5xl mx-auto px-4 py-6">
                {farmers.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-gray-100">
                        <p className="text-sm">契約農家の情報がありません</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {farmers.map((farmer) => (
                            <div
                                key={farmer.id}
                                onClick={() => navigate(`/local/farmers/${farmer.id}`)}
                                className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition cursor-pointer"
                            >
                                <div className="flex">
                                    {/* プロフィール写真 */}
                                    <div className="w-28 h-28 bg-gray-100 flex-shrink-0">
                                        {farmer.profile_photo_url ? (
                                            <img
                                                src={farmer.profile_photo_url}
                                                alt={farmer.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-4xl">
                                                👨‍🌾
                                            </div>
                                        )}
                                    </div>

                                    {/* 農家情報 */}
                                    <div className="flex-1 p-4">
                                        <h3 className="text-lg font-bold text-gray-900 mb-1">{farmer.name}</h3>

                                        {farmer.main_crop && (
                                            <p className="text-sm text-gray-600 mb-1">
                                                <span className="font-medium">主要作物:</span> {farmer.main_crop}
                                            </p>
                                        )}

                                        {farmer.farming_method && (
                                            <p className="text-sm text-gray-600 mb-2">
                                                <span className="font-medium">栽培方法:</span> {farmer.farming_method}
                                            </p>
                                        )}

                                        {farmer.bio && (
                                            <p className="text-sm text-gray-700 line-clamp-2">{farmer.bio}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default LocalFarmers
