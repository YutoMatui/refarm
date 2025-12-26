/**
 * Order Complete Page - 注文完了
 * ストーリー素材のダウンロードリンク表示
 */
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { CheckCircle, Home, Film } from 'lucide-react'
import Loading from '@/components/Loading'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useStore } from '@/store/useStore'

export default function OrderComplete() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const clearCart = useStore((state) => state.clearCart)

  useEffect(() => {
    clearCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          <button onClick={() => navigate('/products')} className="btn-primary mt-4">
            ホームへ戻る
          </button>
        </div>
      </div>
    )
  }

  // Extract farmers with video URLs
  const farmerVideos = order.items.reduce((acc, item) => {
    // Check if farmer info exists and video URL is present
    if (item.farmer_id && item.farmer_video_url && !acc.some(f => f.id === item.farmer_id)) {
      let urls: string[] = []

      // Handle both string (old data) and array (new JSONB data)
      if (Array.isArray(item.farmer_video_url)) {
        urls = item.farmer_video_url
      } else if (typeof item.farmer_video_url === 'string') {
        try {
          const parsed = JSON.parse(item.farmer_video_url)
          if (Array.isArray(parsed)) urls = parsed
          else urls = [item.farmer_video_url]
        } catch {
          urls = [item.farmer_video_url]
        }
      }

      if (urls.length > 0 && urls[0]) {
        acc.push({
          id: item.farmer_id,
          name: item.farmer_name || '生産者',
          url: urls[0]
        })
      }
    }
    return acc
  }, [] as { id: number, name: string, url: string }[])

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
                ¥{Math.floor(parseFloat(order.total_amount)).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Order Items */}
          <div className="border-t pt-4">
            <h3 className="font-bold mb-3">注文商品</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.product_name} × {Number(item.quantity)} {item.product_unit}</span>
                  <span className="font-medium">¥{Math.floor(parseFloat(item.total_amount)).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Story Media Download Section */}
        <div className="card mb-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white border-0 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

          <div className="relative z-10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <Film className="w-6 h-6 text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                FARMER'S STORY
              </h2>
            </div>

            <p className="text-gray-300 mb-6 text-sm leading-relaxed max-w-2xl">
              この野菜を育てた生産者の想いを、お客様にも伝えませんか？<br />
              店頭で使えるストーリー動画やPOP素材をご用意しました。
            </p>

            <div className="space-y-3">
              {farmerVideos.length > 0 ? (
                farmerVideos.map((farmer) => (
                  <a
                    key={farmer.id}
                    href={farmer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between bg-white/10 hover:bg-white/20 p-4 rounded-xl transition-all border border-white/10 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-xs shadow-lg">
                        {farmer.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-yellow-400 transition-colors">{farmer.name}</div>
                        <div className="text-xs text-gray-400">生産者ストーリー動画を見る</div>
                      </div>
                    </div>
                    <div className="bg-white text-gray-900 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 group-hover:scale-105 transition-transform">
                      <span>再生する</span>
                      <Film className="w-3 h-3" />
                    </div>
                  </a>
                ))
              ) : (
                <div className="bg-white/5 rounded-xl p-4 text-center border border-dashed border-white/10">
                  <p className="text-sm text-gray-400">
                    ※ 現在公開されているストーリー動画はありません
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Next Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/products')}
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
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700 leading-relaxed">
            <strong>ご不明な点がございましたら:</strong><br />
            りふぁーむ担当者まで<span className="font-bold text-green-600">ラインの相談チャット</span>からご連絡ください。<br />
            <span className="text-xs text-gray-500 mt-1 block">
              緊急の場合はりふぁーむ代表電話番号 <a href="tel:090-9614-4516" className="text-blue-600 hover:underline">090-9614-4516</a> に連絡してください。
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
