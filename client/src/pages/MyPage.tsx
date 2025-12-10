import { useQuery } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { FileText, Package } from 'lucide-react'
import Loading from '@/components/Loading'

const STATUS_MAP: Record<string, string> = {
  pending: '確認中',
  confirmed: '注文確定',
  shipped: '配送中',
  delivered: '配達完了',
  cancelled: 'キャンセル',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export default function MyPage() {
  const { restaurant } = useStore()

  const { data, isLoading } = useQuery({
    queryKey: ['orders', restaurant?.id],
    queryFn: () => orderApi.list({ restaurant_id: restaurant?.id, limit: 50 }),
    enabled: !!restaurant,
  })

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      const blob = await orderApi.downloadInvoice(orderId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice_${orderId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Invoice download failed:', error)
      alert('請求書のダウンロードに失敗しました')
    }
  }

  if (isLoading) return <Loading message="注文履歴を読み込み中..." />

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <Package className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">マイページ</h2>
          <p className="text-sm text-gray-600">店舗情報と注文履歴を管理します</p>
        </div>
      </div>

      {/* Restaurant Info Card (Optional but nice) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <h3 className="text-lg font-bold mb-4">店舗情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500 text-sm block">店舗名</span>
            <span className="font-medium">{restaurant?.name}</span>
          </div>
          <div>
            <span className="text-gray-500 text-sm block">住所</span>
            <span className="font-medium">{restaurant?.address}</span>
          </div>
          <div>
            <span className="text-gray-500 text-sm block">電話番号</span>
            <span className="font-medium">{restaurant?.phone_number}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">注文履歴</h3>
        </div>

        {/* Order List */}
        <div className="divide-y divide-gray-100">
          {data?.data.items.map((order) => (
            <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                      {STATUS_MAP[order.status] || order.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      注文日: {new Date(order.created_at).toLocaleDateString('ja-JP')}
                    </span>
                    <span className="text-sm text-gray-500">
                      注文ID: #{order.id}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        ¥{Number(order.total_amount).toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">
                        (配送希望日: {new Date(order.delivery_date).toLocaleDateString('ja-JP')})
                      </span>
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mt-2">
                    <p className="font-medium mb-1">注文内容 ({order.items.length}点):</p>
                    <ul className="list-disc list-inside pl-1 space-y-0.5">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <li key={idx} className="truncate">
                          {item.product_name} × {item.quantity}{item.product_unit}
                        </li>
                      ))}
                      {order.items.length > 3 && (
                        <li className="list-none text-gray-400 pl-4 text-xs">
                          他 {order.items.length - 3} 点...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 min-w-[140px]">
                  <button
                    onClick={() => handleDownloadInvoice(order.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition-all w-full text-sm font-medium shadow-sm"
                  >
                    <FileText size={16} />
                    <span>請求書発行</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(!data?.data.items || data.data.items.length === 0) && (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <Package className="w-12 h-12 text-gray-300 mb-3" />
              <p>注文履歴がありません</p>
              <p className="text-sm mt-1 text-gray-400">商品一覧から注文を行ってください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
