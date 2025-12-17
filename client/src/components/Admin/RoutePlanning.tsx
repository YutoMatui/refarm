import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Truck, Navigation, Calendar, MapPin as MapPinIcon } from 'lucide-react'
import { logisticsApi } from '../../services/api'
import type { RouteResponse } from '../../types'

export default function RoutePlanning() {
    const [activeTab, setActiveTab] = useState<'collection' | 'delivery'>('collection')
    const [route, setRoute] = useState<RouteResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Collection Form
    const { register: registerCollection, handleSubmit: handleSubmitCollection } = useForm<{ start_address: string }>()

    // Delivery Form
    const { register: registerDelivery, handleSubmit: handleSubmitDelivery } = useForm<{ date: string }>()

    const onCollectionSubmit = async (data: { start_address: string }) => {
        setLoading(true)
        setError(null)
        setRoute(null)
        try {
            const res = await logisticsApi.getCollectionRoute(data.start_address)
            setRoute(res.data)
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.detail?.error || err.response?.data?.detail || 'ルート計算に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    const onDeliverySubmit = async (data: { date: string }) => {
        setLoading(true)
        setError(null)
        setRoute(null)
        try {
            const res = await logisticsApi.getDeliveryRoute(data.date)
            setRoute(res.data)
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.detail?.error || err.response?.data?.detail || 'ルート計算に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">ルート最適化</h2>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => { setActiveTab('collection'); setRoute(null); setError(null); }}
                        className={`${activeTab === 'collection'
                            ? 'border-green-500 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <Truck className="w-4 h-4" />
                        集荷ルート (農家巡回)
                    </button>
                    <button
                        onClick={() => { setActiveTab('delivery'); setRoute(null); setError(null); }}
                        className={`${activeTab === 'delivery'
                            ? 'border-green-500 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <Navigation className="w-4 h-4" />
                        配送ルート (飲食店)
                    </button>
                </nav>
            </div>

            {/* Input Forms */}
            <div className="bg-white p-6 rounded-lg shadow">
                {activeTab === 'collection' ? (
                    <form onSubmit={handleSubmitCollection(onCollectionSubmit)} className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">出発点の住所</label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MapPinIcon className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    {...registerCollection('start_address', { required: true })}
                                    className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border px-3"
                                    placeholder="例: 兵庫県神戸市中央区..."
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? '計算中...' : 'ルート計算'}
                            <Navigation className="w-4 h-4" />
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmitDelivery(onDeliverySubmit)} className="flex items-end gap-4">
                        <div className="flex-1 max-w-xs">
                            <label className="block text-sm font-medium text-gray-700 mb-1">配送日</label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Calendar className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="date"
                                    {...registerDelivery('date')}
                                    defaultValue={new Date().toISOString().split('T')[0]}
                                    className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border px-3"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? '計算中...' : 'ルート計算'}
                            <Navigation className="w-4 h-4" />
                        </button>
                    </form>
                )}
            </div>

            {/* Results */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                    <div className="flex">
                        <div className="ml-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {route && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-lg font-medium text-gray-900">最適ルート案内</h3>
                        <div className="text-sm text-gray-500 space-x-4">
                            <span>総距離: <strong>{route.total_distance}</strong></span>
                            <span>総時間: <strong>{route.total_duration}</strong></span>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="relative border-l-2 border-green-200 ml-3 space-y-8">
                            {route.timeline.map((step, idx) => (
                                <div key={idx} className="relative pl-8">
                                    {/* Icon */}
                                    <div className={`absolute -left-[9px] w-4 h-4 rounded-full border-2 ${step.type === 'start' ? 'bg-blue-500 border-blue-500' :
                                        step.type === 'end' ? 'bg-red-500 border-red-500' :
                                            'bg-white border-green-500'
                                        }`}></div>

                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start group">
                                        <div>
                                            <p className="font-bold text-gray-900">
                                                {step.type === 'start' ? '出発' :
                                                    step.type === 'end' ? '到着' :
                                                        step.name}
                                            </p>
                                            <p className="text-sm text-gray-500">{step.address}</p>
                                            {step.data?.delivery_window_start && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                                                    希望: {step.data.delivery_window_start} - {step.data.delivery_window_end}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-2 sm:mt-0 text-right text-sm text-gray-500">
                                            {step.arrival_time_estimate && (
                                                <p className="font-mono text-green-700">{step.arrival_time_estimate} 後に到着</p>
                                            )}
                                            {step.distance && (
                                                <p className="text-xs">区間: {step.distance}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-right">
                        <a
                            href={`https://www.google.com/maps/dir/${route.timeline.map(s => encodeURIComponent(s.address)).join('/')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                        >
                            Google Mapで開く &rarr;
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}


