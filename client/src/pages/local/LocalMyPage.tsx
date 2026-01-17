import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Package, MapPin, User, MessageCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/store/useStore'
import { consumerOrderApi } from '@/services/api'
import type { ConsumerOrder } from '@/types'

const LocalMyPage = () => {
    const navigate = useNavigate()
    const consumer = useStore(state => state.consumer)
    const queryClient = useQueryClient()

    // 注文一覧を取得
    const { data: ordersData } = useQuery({
        queryKey: ['consumer-orders'],
        queryFn: async () => {
            const response = await consumerOrderApi.list()
            return response.data
        }
    })

    const orders = ordersData?.items || []

    // 現在の注文（PENDING, CONFIRMED, PREPARING, SHIPPED）
    const currentOrders = orders.filter((order: ConsumerOrder) =>
        ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED'].includes(order.status.toUpperCase())
    )

    // 過去の注文（DELIVERED, CANCELLED）
    const pastOrders = orders.filter((order: ConsumerOrder) =>
        ['DELIVERED', 'CANCELLED'].includes(order.status.toUpperCase())
    )

    // 受け取り完了処理
    const completeReceiptMutation = useMutation({
        mutationFn: async (orderId: number) => {
            const response = await consumerOrderApi.updateStatus(orderId, 'DELIVERED')
            return response.data
        },
        onSuccess: () => {
            toast.success('受け取り完了しました！')
            queryClient.invalidateQueries({ queryKey: ['consumer-orders'] })
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail || '更新に失敗しました')
        }
    })

    const handleCompleteReceipt = async (orderId: number) => {
        if (window.confirm('受け取りを完了しますか？')) {
            await completeReceiptMutation.mutateAsync(orderId)
        }
    }

    const getStatusText = (status: string) => {
        const statusMap: { [key: string]: string } = {
            'PENDING': '注文確認中',
            'CONFIRMED': '確認済み',
            'PREPARING': '準備中',
            'SHIPPED': '配送中',
            'DELIVERED': '完了',
            'CANCELLED': 'キャンセル'
        }
        return statusMap[status.toUpperCase()] || status
    }

    const getStatusColor = (status: string) => {
        const statusUpper = status.toUpperCase()
        const colorMap: { [key: string]: string } = {
            'PENDING': 'bg-yellow-100 text-yellow-800',
            'CONFIRMED': 'bg-blue-100 text-blue-800',
            'PREPARING': 'bg-purple-100 text-purple-800',
            'SHIPPED': 'bg-emerald-100 text-emerald-800',
            'DELIVERED': 'bg-green-100 text-green-800',
            'CANCELLED': 'bg-red-100 text-red-800'
        }
        return colorMap[statusUpper] || 'bg-gray-100 text-gray-800'
    }

    const formatDeliveryInfo = (order: ConsumerOrder) => {
        const deliveryType = order.delivery_type?.toUpperCase() || ''
        if (deliveryType === 'HOME') {
            return `自宅配送 (${order.delivery_time_label || ''})`
        } else if (deliveryType === 'UNIVERSITY') {
            return `大学受取 (${order.delivery_time_label || ''})`
        } else {
            return `${order.delivery_label || '受取'} (${order.delivery_time_label || ''})`
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="bg-white border-b border-gray-200 px-4 py-4 safe-area-pt">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-xl font-bold text-gray-900">マイページ</h1>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* 現在の注文 */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="text-emerald-600" size={20} />
                        現在の注文
                    </h2>

                    {currentOrders.length > 0 ? (
                        <div className="space-y-3">
                            {currentOrders.map((order: ConsumerOrder) => (
                                <div
                                    key={order.id}
                                    className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition"
                                >
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                                                        {getStatusText(order.status)}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        注文番号: #{order.id}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                    <MapPin size={14} className="text-gray-400" />
                                                    {formatDeliveryInfo(order)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-emerald-600">
                                                    ¥{Number(order.total_amount).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-2">注文内容:</p>
                                            <div className="space-y-1">
                                                {order.items?.slice(0, 2).map((item: any) => (
                                                    <p key={item.id} className="text-sm text-gray-700">
                                                        {item.product_name} × {item.quantity}
                                                    </p>
                                                ))}
                                                {order.items && order.items.length > 2 && (
                                                    <p className="text-xs text-gray-500">
                                                        他 {order.items.length - 2} 点
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* 受け取り完了ボタン */}
                                        {order.status.toUpperCase() === 'SHIPPED' && (
                                            <button
                                                onClick={() => handleCompleteReceipt(order.id)}
                                                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-md flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle size={18} />
                                                受け取り完了
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
                            <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">現在進行中の注文はありません</p>
                        </div>
                    )}
                </section>

                {/* 注文履歴 */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Package className="text-gray-600" size={20} />
                        注文履歴
                    </h2>

                    {pastOrders.length > 0 ? (
                        <div className="space-y-3">
                            {pastOrders.map((order: ConsumerOrder) => (
                                <div
                                    key={order.id}
                                    className="bg-white rounded-lg border border-gray-200 p-4"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                                                    {getStatusText(order.status)}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(order.created_at).toLocaleDateString('ja-JP')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700">
                                                {formatDeliveryInfo(order)}
                                            </p>
                                        </div>
                                        <p className="text-lg font-bold text-gray-900">
                                            ¥{Number(order.total_amount).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {order.items?.length}点の商品
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
                            <p className="text-gray-500 text-sm">注文履歴がありません</p>
                        </div>
                    )}
                </section>

                {/* 会員情報 */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="text-gray-600" size={20} />
                        会員情報
                    </h2>

                    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">お名前</p>
                            <p className="text-sm font-medium text-gray-900">{consumer?.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">電話番号</p>
                            <p className="text-sm font-medium text-gray-900">{consumer?.phone_number}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">郵便番号</p>
                            <p className="text-sm font-medium text-gray-900">〒{consumer?.postal_code}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">住所</p>
                            <p className="text-sm font-medium text-gray-900">
                                {consumer?.address}
                                {consumer?.building && consumer.building !== 'なし' && ` ${consumer.building}`}
                            </p>
                        </div>

                        <button
                            onClick={() => navigate('/local/profile')}
                            className="w-full mt-4 border-2 border-gray-200 text-gray-700 font-semibold py-2 rounded-md hover:bg-gray-50"
                        >
                            会員情報を編集
                        </button>
                    </div>
                </section>

                {/* お問い合わせ */}
                <section>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <MessageCircle className="text-gray-600" size={20} />
                        お問い合わせ
                    </h2>

                    <div className="bg-white rounded-lg border border-gray-200">
                        <a
                            href="https://line.me/R/ti/p/@your-line-id"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 hover:bg-gray-50 transition"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                                    LINE
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">公式LINEでお問い合わせ</p>
                                    <p className="text-xs text-gray-500">トーク画面で直接ご質問いただけます</p>
                                </div>
                            </div>
                            <ExternalLink size={18} className="text-gray-400" />
                        </a>
                    </div>
                </section>
            </div>
        </div>
    )
}

export default LocalMyPage
