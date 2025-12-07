/**
 * Order Complete Page - 注文完了
 * ストーリー素材のダウンロードリンク表示
 */
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { CheckCircle, Download, Home, Film } from 'lucide-react'
import Loading from '@/components/Loading'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function OrderComplete() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const response = await orderApi.getById(parseInt(orderId!))
      return response.data
    },
    enabled: !!orderId,
  })

  if (isLoading) return <Loading message="注文情報を読み込み中..." />
  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">注文が見つかりません</p>
          <button onClick={() => navigate('/catalog')} className="btn-primary mt-4">
            ホームへ戻る
          </button>
        </div>
      </div>
    )
  }

  // Extract products with media URLs
  const productsWithMedia = order.items
    .map((item) => item)
    .filter((item) => {
      // In real app, fetch product details to get media_url
      // For now, check if product has media
      return true // Placeholder
    })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Banner */}
      <div className="bg-green-50 border-b border-green-200">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">注文が完了しました!</h1>
          <p className="text-gray-700">
            注文ID: <span className="font-mono font-bold">#{order.id}</span>
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Order Details */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">注文内容</h2>
          
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">配送予定日</p>
              <p className="font-bold">
                {format(new Date(order.delivery_date), 'M月d日(E)', { locale: ja })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">配送時間帯</p>
              <p className="font-bold">
                {order.delivery_time_slot === '12-14' && '12:00 〜 14:00'}
                {order.delivery_time_slot === '14-16' && '14:00 〜 16:00'}
                {order.delivery_time_slot === '16-18' && '16:00 〜 18:00'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">配送先</p>
              <p className="font-medium">{order.delivery_address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">合計金額</p>
              <p className="text-2xl font-bold text-green-600">
                ¥{parseFloat(order.total_amount).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Order Items */}
          <div className="border-t pt-4">
            <h3 className="font-bold mb-3">注文商品</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.product_name} × {item.quantity}{item.product_unit}</span>
                  <span className="font-medium">¥{parseFloat(item.total_amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Story Media Download Section */}
        <div className="card mb-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-600 rounded-lg">
              <Film className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-2">
                🎬 ストーリー素材をお店の「武器」に
              </h2>
              <p className="text-gray-700 mb-4">
                今回注文いただいた野菜の「生産者ストーリー動画」や「店頭POP素材」をダウンロードできます。
                SNSでの発信やメニュー説明にご活用ください!
              </p>

              {/* Media Download Links (Placeholder) */}
              <div className="space-y-2">
                {productsWithMedia.length > 0 ? (
                  productsWithMedia.map((item) => (
                    <button
                      key={item.id}
                      className="w-full flex items-center justify-between bg-white p-3 rounded-lg hover:shadow-md transition-shadow border border-blue-200"
                    >
                      <span className="font-medium">{item.product_name} - ストーリー動画</span>
                      <Download className="w-5 h-5 text-blue-600" />
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-600 italic">
                    ※ ストーリー素材は準備中です。Refarm担当者より別途ご連絡いたします。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Next Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/catalog')}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            ホームへ戻る
          </button>
          <button
            onClick={() => navigate('/mypage')}
            className="btn-secondary flex-1"
          >
            注文履歴を見る
          </button>
        </div>

        {/* Contact Info */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>ご不明な点がございましたら:</strong><br />
            Refarm担当者までお気軽にお問い合わせください。<br />
            📞 078-XXX-XXXX | ✉️ support@refarm-eos.com
          </p>
        </div>
      </div>
    </div>
  )
}
