import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { consumerOrderApi } from '@/services/api'
import type { ConsumerOrder } from '@/types'

const LocalOrderComplete = () => {
    const { orderId } = useParams()

    const { data, isLoading, isError } = useQuery({
        queryKey: ['consumer-order', orderId],
        queryFn: async () => {
            if (!orderId) return null
            const response = await consumerOrderApi.getById(Number(orderId))
            return response.data as ConsumerOrder
        },
        enabled: Boolean(orderId),
    })

    if (isLoading) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-10">
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">
                    注文情報を読み込んでいます...
                </div>
            </div>
        )
    }

    if (isError || !data) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-10 space-y-4 text-center">
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-red-700">
                    注文情報の取得に失敗しました。
                </div>
                <Link
                    to="/local"
                    className="inline-flex items-center justify-center px-5 py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700"
                >
                    商品一覧へ戻る
                </Link>
            </div>
        )
    }

    const pickupDate = data.delivery_slot?.date
        ? format(parseISO(data.delivery_slot.date), 'M月d日(E)', { locale: ja })
        : data.delivery_time_label

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
            <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm text-center space-y-4">
                <h1 className="text-2xl font-bold text-emerald-700">ご注文ありがとうございました！</h1>
                <p className="text-gray-600">ご注文番号: {data.id.toString().padStart(6, '0')}</p>
                <p className="text-gray-700">
                    ご注文内容の詳細はLINEにてお送りしました。受取日時・場所をご確認の上、お釣りのないようご準備をお願いいたします。
                </p>
            </div>

            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">お受け取り情報</h2>
                <div className="space-y-1 text-sm text-gray-700">
                    <p><span className="font-semibold">日時：</span>{pickupDate}{data.delivery_slot?.date ? ` ${data.delivery_time_label}` : ''}</p>
                    <p><span className="font-semibold">場所：</span>{data.delivery_type === 'HOME' ? 'ご自宅' : data.delivery_label}</p>
                    {data.delivery_address && (
                        <p><span className="font-semibold">住所：</span>{data.delivery_address}</p>
                    )}
                </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">ご注文内容</h2>
                <div className="space-y-2 text-sm text-gray-700">
                    {data.items.map(item => (
                        <div key={item.id} className="flex justify-between">
                            <span>{item.product_name} × {item.quantity}{item.product_unit}</span>
                            <span>¥{Math.round(parseFloat(String(item.total_amount))).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
                <div className="border-t border-gray-200 pt-3 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                        <span>商品合計</span>
                        <span>¥{Math.round(parseFloat(String(data.subtotal))).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>送料</span>
                        <span>{data.shipping_fee === 0 ? '無料' : `¥${data.shipping_fee.toLocaleString()}`}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg text-gray-900">
                        <span>お支払い合計</span>
                        <span>¥{Math.round(parseFloat(String(data.total_amount))).toLocaleString()}</span>
                    </div>
                </div>
            </section>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-900 space-y-2">
                <p>お支払いは【商品受取時に現金】でお願いいたします。お釣りが出ないようご協力をお願いいたします。</p>
                <p>ご不明点がございましたら、LINEのメッセージからお問い合わせください。</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                <Link
                    to="/local"
                    className="inline-flex items-center justify-center px-5 py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700"
                >
                    商品一覧へ戻る
                </Link>
                <Link
                    to="/local/cart"
                    className="inline-flex items-center justify-center px-5 py-2 border border-emerald-600 text-emerald-700 font-semibold rounded-md hover:bg-emerald-50"
                >
                    カートを確認する
                </Link>
            </div>
        </div>
    )
}

export default LocalOrderComplete
