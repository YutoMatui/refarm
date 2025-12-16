import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { Order, OrderStatus } from '@/types'
import { FileText, Truck, ChevronDown, ChevronUp } from 'lucide-react'
import Loading from '@/components/Loading'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function DeliveryManagement() {
    const queryClient = useQueryClient()
    const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set())

    const toggleOrderExpand = (orderId: number) => {
        const newExpanded = new Set(expandedOrders)
        if (newExpanded.has(orderId)) {
            newExpanded.delete(orderId)
        } else {
            newExpanded.add(orderId)
        }
        setExpandedOrders(newExpanded)
    }

    const { data, isLoading } = useQuery({
        queryKey: ['admin-orders'],
        queryFn: async () => {
            // 全注文を取得
            const response = await orderApi.list({ limit: 100 })
            return response.data
        },
    })

    // PDF Download Handler - 請求書・納品書のダウンロード処理
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

    // ステータス更新
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

    if (isLoading) return <Loading message="注文情報を読み込み中..." />

    const orders = data?.items || []

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
                <h2 className="text-xl font-bold">配送・注文管理</h2>
                <p className="text-sm text-gray-600 mt-1">注文一覧の確認、各種帳票のダウンロードができます</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">注文ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">配送日・時間</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">飲食店名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">注文内容</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金額</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ステータス</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳票</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {orders.map((order: Order) => (
                            <tr key={order.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 text-sm text-gray-900">#{order.id}</td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    <div>{format(new Date(order.delivery_date), 'MM/dd(E)', { locale: ja })}</div>
                                    <div className="text-gray-500 text-xs">{order.delivery_time_slot}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    <div className="font-medium">{order.restaurant?.name || `Restaurant #${order.restaurant_id}`}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-[150px]">{order.delivery_address}</div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                    <div className="space-y-2">
                                        {order.items && order.items.length > 0 && (expandedOrders.has(order.id) ? order.items : [order.items[0]]).map((item) => (
                                            <div key={item.id} className="text-xs border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                                                <div className="font-medium text-gray-800">{item.product_name}</div>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                                                        {item.farmer_name || '農家不明'}
                                                    </span>
                                                    <span className="font-medium">
                                                        ×{item.quantity}<span className="text-gray-500 font-normal">{item.product_unit}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {order.items.length > 1 && (
                                            <button
                                                onClick={() => toggleOrderExpand(order.id)}
                                                className="text-blue-600 text-xs mt-1 flex items-center gap-1 hover:underline w-full justify-center bg-blue-50 py-1 rounded"
                                            >
                                                {expandedOrders.has(order.id) ? (
                                                    <>
                                                        <ChevronUp className="w-3 h-3" />
                                                        閉じる
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="w-3 h-3" />
                                                        すべて見る ({order.items.length}点)
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    ¥{parseInt(order.total_amount).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                        value={order.status}
                                        onChange={(e) => updateStatusMutation.mutate({ id: order.id, status: e.target.value as OrderStatus })}
                                    >
                                        <option value={OrderStatus.PENDING}>未確定</option>
                                        <option value={OrderStatus.CONFIRMED}>受注確定</option>
                                        <option value={OrderStatus.SHIPPED}>配送中</option>
                                        <option value={OrderStatus.DELIVERED}>配達完了</option>
                                        <option value={OrderStatus.CANCELLED}>キャンセル</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDownload(order.id, 'invoice')}
                                            className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                                            title="請求書ダウンロード"
                                        >
                                            <FileText className="w-3 h-3" /> 請求書
                                        </button>
                                        <button
                                            onClick={() => handleDownload(order.id, 'delivery_slip')}
                                            className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100"
                                            title="納品書ダウンロード"
                                        >
                                            <Truck className="w-3 h-3" /> 納品書
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
