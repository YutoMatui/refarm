import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { Order, OrderStatus } from '@/types'
import { Search, Calendar, Package, ChevronDown, ChevronUp, FileText, Truck, Trash2, Store } from 'lucide-react'
import Loading from '@/components/Loading'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    PENDING: { label: '未確定', color: 'bg-yellow-100 text-yellow-800' },
    CONFIRMED: { label: '受注確定', color: 'bg-blue-100 text-blue-800' },
    PREPARING: { label: '準備中', color: 'bg-purple-100 text-purple-800' },
    SHIPPED: { label: '配送中', color: 'bg-emerald-100 text-emerald-800' },
    DELIVERED: { label: '配達完了', color: 'bg-green-100 text-green-800' },
    CANCELLED: { label: 'キャンセル', color: 'bg-red-100 text-red-800' },
}

export default function DeliveryManagement() {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['admin-orders'],
        queryFn: async () => {
            const response = await orderApi.list({ limit: 100 })
            return response.data
        },
    })

    const handleDownload = async (orderId: number, type: 'invoice' | 'delivery_slip') => {
        try {
            const blob = type === 'invoice'
                ? await orderApi.downloadInvoice(orderId)
                : await orderApi.downloadDeliverySlip(orderId)

            const url = window.URL.createObjectURL(new Blob([blob]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `${type === 'invoice' ? 'invoice' : 'delivery_slip'}_${orderId}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (error) {
            console.error('Download failed:', error)
            alert('ダウンロードに失敗しました')
        }
    }

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: number; status: OrderStatus }) => {
            await orderApi.updateStatus(id, status)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
            alert('ステータスを更新しました')
        },
        onError: () => {
            alert('更新に失敗しました')
        }
    })

    const deleteItemMutation = useMutation({
        mutationFn: async ({ orderId, itemId }: { orderId: number; itemId: number }) => {
            if (!confirm('このアイテムを削除しますか？\n削除すると担当農家にLINE通知が送信されます。')) return;
            await orderApi.deleteItem(orderId, itemId)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
            alert('アイテムを削除しました')
        },
        onError: (err: any) => {
            const msg = err.response?.data?.detail || '削除に失敗しました';
            alert(msg)
        }
    })

    if (isLoading) return <Loading message="注文情報を読み込み中..." />

    const orders = (data?.items || [])
        .slice()
        .sort((a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const filteredOrders = orders.filter((order: Order) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
            String(order.id).includes(q) ||
            order.restaurant?.name?.toLowerCase().includes(q) ||
            order.items?.some((item) => item.product_name?.toLowerCase().includes(q))
        )
    })

    const toggleExpand = (orderId: number) => {
        setExpandedOrderId(prev => prev === orderId ? null : orderId)
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">注文履歴（飲食店）</h2>
                <p className="text-sm text-gray-600 mt-1">全 {orders.length} 件</p>
            </div>

            {/* 検索 */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="注文番号、飲食店名、商品名で検索..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* 注文一覧 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {filteredOrders.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                        {filteredOrders.map((order: Order) => {
                            const s = STATUS_MAP[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-800' }
                            const isExpanded = expandedOrderId === order.id

                            return (
                                <div key={order.id} className="hover:bg-gray-50 transition">
                                    {/* 注文サマリー行 */}
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(order.id)}
                                        className="w-full px-4 py-3 flex items-center gap-4 text-left"
                                    >
                                        <div className="flex-shrink-0 w-16 text-xs text-gray-500 font-mono">
                                            #{String(order.id).padStart(6, '0')}
                                        </div>
                                        <div className="flex-shrink-0">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                                                {s.label}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1">
                                                <Store size={13} className="text-gray-400 flex-shrink-0" />
                                                {order.restaurant?.name || `Restaurant #${order.restaurant_id}`}
                                            </p>
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                <Calendar size={11} />
                                                {format(new Date(order.delivery_date), 'MM/dd(E)', { locale: ja })} {order.delivery_time_slot}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <p className="font-bold text-emerald-700">
                                                ¥{parseInt(order.total_amount).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {order.items?.length || 0}点
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0">
                                            {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                        </div>
                                    </button>

                                    {/* 展開した明細 */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0">
                                            <div className="bg-gray-50 rounded-lg p-4 ml-16 space-y-3">
                                                {/* 注文情報 */}
                                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                                    <div>
                                                        <span className="text-gray-400">注文日時: </span>
                                                        {format(new Date(order.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">配送先: </span>
                                                        {order.delivery_address || '-'}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">電話: </span>
                                                        {order.delivery_phone || '-'}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400">配送日時: </span>
                                                        {format(new Date(order.delivery_date), 'yyyy/MM/dd(E)', { locale: ja })} {order.delivery_time_slot}
                                                    </div>
                                                </div>

                                                {/* ステータス変更 */}
                                                <div className="border-t border-gray-200 pt-2 flex items-center gap-3">
                                                    <span className="text-xs font-semibold text-gray-500">ステータス変更:</span>
                                                    <select
                                                        className="text-xs border-gray-300 rounded-md shadow-sm focus:border-emerald-300 focus:ring focus:ring-emerald-200 focus:ring-opacity-50 py-1 px-2"
                                                        value={order.status}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => updateStatusMutation.mutate({ id: order.id, status: e.target.value as OrderStatus })}
                                                    >
                                                        <option value={OrderStatus.PENDING}>未確定</option>
                                                        <option value={OrderStatus.CONFIRMED}>受注確定</option>
                                                        <option value={OrderStatus.SHIPPED}>配送中</option>
                                                        <option value={OrderStatus.DELIVERED}>配達完了</option>
                                                        <option value={OrderStatus.CANCELLED}>キャンセル</option>
                                                    </select>
                                                </div>

                                                {/* 商品明細 */}
                                                <div className="border-t border-gray-200 pt-2">
                                                    <p className="text-xs font-semibold text-gray-500 mb-1">商品明細</p>
                                                    {order.items?.map((item) => (
                                                        <div key={item.id} className="flex justify-between items-center text-sm py-1">
                                                            <span className="text-gray-700 flex items-center gap-1">
                                                                {item.product_name} × {item.quantity}{item.product_unit}
                                                                {item.farmer_name && <span className="text-xs text-gray-400 ml-1">({item.farmer_name})</span>}
                                                                <button
                                                                    onClick={() => deleteItemMutation.mutate({ orderId: order.id, itemId: item.id })}
                                                                    className="text-red-400 hover:text-red-600 p-0.5 ml-1"
                                                                    title="アイテムを削除"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </span>
                                                            <span className="font-medium text-gray-900">
                                                                ¥{Math.round(Number(item.total_amount)).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* 合計 */}
                                                <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                                                    <span className="font-semibold text-gray-700">合計</span>
                                                    <span className="font-bold text-emerald-700">
                                                        ¥{parseInt(order.total_amount).toLocaleString()}
                                                    </span>
                                                </div>

                                                {/* 帳票ダウンロード */}
                                                <div className="border-t border-gray-200 pt-2 flex gap-2">
                                                    <button
                                                        onClick={() => handleDownload(order.id, 'invoice')}
                                                        className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100"
                                                    >
                                                        <FileText className="w-3 h-3" /> 請求書
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(order.id, 'delivery_slip')}
                                                        className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100"
                                                    >
                                                        <Truck className="w-3 h-3" /> 納品書
                                                    </button>
                                                </div>
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
