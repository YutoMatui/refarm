import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Calendar, Package, ChevronDown, ChevronUp, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { adminConsumerApi } from '@/services/api'
import type { Consumer } from '@/types'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending: { label: '確認中', color: 'bg-yellow-100 text-yellow-800' },
    confirmed: { label: '確認済', color: 'bg-blue-100 text-blue-800' },
    preparing: { label: '準備中', color: 'bg-purple-100 text-purple-800' },
    shipped: { label: '配送中', color: 'bg-emerald-100 text-emerald-800' },
    delivered: { label: '完了', color: 'bg-green-100 text-green-800' },
    completed: { label: '完了', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-800' },
}

const ConsumerOrderManagement = () => {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)
    const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null)
    const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null)

    // 全消費者を取得
    const { data: consumersData } = useQuery({
        queryKey: ['admin-consumers'],
        queryFn: async () => {
            const response = await adminConsumerApi.list({ limit: 200 })
            return response.data
        },
    })

    const consumers = consumersData?.items || []

    // 全消費者の注文を取得
    const { data: allOrders = [], isLoading } = useQuery({
        queryKey: ['admin-all-consumer-orders', consumers.map((c: Consumer) => c.id).join(',')],
        queryFn: async () => {
            const results = await Promise.all(
                consumers.map(async (consumer: Consumer) => {
                    try {
                        const res = await adminConsumerApi.getOrders(consumer.id)
                        return (res.data as any[]).map((order: any) => ({
                            ...order,
                            consumer_name: consumer.name ?? '未登録',
                            consumer_phone: consumer.phone_number ?? '',
                            consumer_id: consumer.id,
                        }))
                    } catch {
                        return []
                    }
                })
            )
            return results.flat().sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
        },
        enabled: consumers.length > 0,
    })

    // 検索フィルター
    const filteredOrders = allOrders.filter((order: any) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
            order.consumer_name?.toLowerCase().includes(q) ||
            String(order.id).includes(q) ||
            order.items?.some((item: any) => item.product_name?.toLowerCase().includes(q))
        )
    })

    const toggleExpand = (orderId: number) => {
        setExpandedOrderId(prev => prev === orderId ? null : orderId)
    }

    const handleCancelOrder = async (orderId: number) => {
        setCancellingOrderId(orderId)
        try {
            const res = await adminConsumerApi.cancelOrder(orderId)
            toast.success(res.data.message)
            queryClient.invalidateQueries({ queryKey: ['admin-all-consumer-orders'] })
        } catch (error: any) {
            const msg = error?.response?.data?.detail || '注文のキャンセルに失敗しました'
            toast.error(msg)
        } finally {
            setCancellingOrderId(null)
            setConfirmCancelId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">注文履歴（消費者）</h2>
                <p className="text-sm text-gray-600 mt-1">全 {allOrders.length} 件</p>
            </div>

            {/* 検索 */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="注文番号、顧客名、商品名で検索..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* 注文一覧 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">読み込み中...</div>
                ) : filteredOrders.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {filteredOrders.map((order: any) => {
                            const s = STATUS_MAP[order.status?.toLowerCase()] || { label: order.status, color: 'bg-gray-100 text-gray-800' }
                            const isExpanded = expandedOrderId === order.id

                            return (
                                <div key={order.id} className="hover:bg-gray-50 transition">
                                    {/* 注文サマリー行 */}
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(order.id)}
                                        className="w-full px-4 py-3 flex items-center gap-4 text-left"
                                    >
                                        <div className="flex-shrink-0 w-20 text-xs text-gray-500 font-mono">
                                            #{String(order.id).padStart(6, '0')}
                                        </div>
                                        <div className="flex-shrink-0">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                                                {s.label}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {order.consumer_name}
                                            </p>
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                {order.delivery_date && (
                                                    <>
                                                        <Calendar size={11} />
                                                        {order.delivery_date} {order.delivery_time_label}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <p className="font-bold text-emerald-700">
                                                ¥{Math.round(Number(order.total_amount)).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {order.payment_method === 'card' ? 'カード' : '現金'}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                        </div>
                                    </button>

                                    {/* 展開した明細 */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0">
                                            <div className="bg-gray-50 rounded-lg p-4 ml-20 space-y-3">
                                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                                    <div>
                                                        <span className="text-gray-400">注文日時: </span>
                                                        {order.created_at ? new Date(order.created_at).toLocaleString('ja-JP') : '-'}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">受取: </span>
                                                        {order.delivery_label || 'ユニバードーム付近'}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">電話: </span>
                                                        {order.consumer_phone || '-'}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">送料: </span>
                                                        {order.shipping_fee === 0 ? '無料' : `¥${order.shipping_fee}`}
                                                    </div>
                                                </div>

                                                <div className="border-t border-gray-200 pt-2">
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">商品明細</p>
                                                    {order.items?.map((item: any) => (
                                                        <div key={item.id} className="flex justify-between text-sm py-1">
                                                            <span className="text-gray-700">
                                                                {item.product_name} × {item.quantity}{item.product_unit}
                                                                {item.farmer_name && <span className="text-xs text-gray-400 ml-1">({item.farmer_name})</span>}
                                                            </span>
                                                            <span className="font-medium text-gray-900">
                                                                ¥{Math.round(Number(item.total_amount)).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                                                    <span className="font-semibold text-gray-700">合計</span>
                                                    <span className="font-bold text-emerald-700">
                                                        ¥{Math.round(Number(order.total_amount)).toLocaleString()}
                                                    </span>
                                                </div>

                                                {/* キャンセルボタン */}
                                                {order.status?.toLowerCase() !== 'cancelled' && (
                                                    <div className="border-t border-gray-200 pt-3">
                                                        {confirmCancelId === order.id ? (
                                                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                                                                <p className="text-sm text-red-700 font-semibold">
                                                                    この注文をキャンセルしますか？
                                                                    {order.payment_method === 'card' && 'カード決済の返金も行われます。'}
                                                                </p>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCancelOrder(order.id)}
                                                                        disabled={cancellingOrderId === order.id}
                                                                        className="px-4 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60"
                                                                    >
                                                                        {cancellingOrderId === order.id ? '処理中...' : 'キャンセル実行'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setConfirmCancelId(null)}
                                                                        className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-300"
                                                                    >
                                                                        戻る
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setConfirmCancelId(order.id)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 font-medium border border-red-200 rounded-lg hover:bg-red-50 transition"
                                                            >
                                                                <XCircle size={14} />
                                                                注文をキャンセル
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="p-12 text-center text-gray-400">
                        <Package size={32} className="mx-auto mb-2" />
                        <p>注文データがありません</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ConsumerOrderManagement
