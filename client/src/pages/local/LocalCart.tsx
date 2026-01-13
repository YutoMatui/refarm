import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'sonner'
import { consumerOrderApi, deliverySlotApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { DeliverySlotType, type DeliverySlot, type ConsumerOrder, type ConsumerOrderCreateRequest } from '@/types'

const formatSlotLabel = (slot: DeliverySlot) => {
    const dateText = slot.date ? format(parseISO(slot.date), 'M月d日(E)', { locale: ja }) : ''
    return `${dateText} ${slot.time_text}`
}

const LocalCart = () => {
    const navigate = useNavigate()
    const cart = useStore(state => state.cart)
    const consumer = useStore(state => state.consumer)
    const clearCart = useStore(state => state.clearCart)

    const [deliveryType, setDeliveryType] = useState<DeliverySlotType>(DeliverySlotType.HOME)
    const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
    const [deliveryNotes, setDeliveryNotes] = useState('')
    const [orderNotes, setOrderNotes] = useState('')
    const [overrideAddress, setOverrideAddress] = useState('')

    useEffect(() => {
        if (consumer) {
            const baseAddress = `${consumer.address}${consumer.building ? ` ${consumer.building}` : ''}`
            setOverrideAddress(baseAddress.trim())
        }
    }, [consumer])

    const { data: slotData, isLoading: isSlotsLoading } = useQuery<DeliverySlot[]>({
        queryKey: ['delivery-slots', deliveryType],
        queryFn: async () => {
            const response = await deliverySlotApi.list({ slot_type: deliveryType })
            return response.data as DeliverySlot[]
        },
    })

    const slots = useMemo<DeliverySlot[]>(() => slotData ?? [], [slotData])

    useEffect(() => {
        if (slots.length > 0) {
            setSelectedSlotId(slots[0].id)
        } else {
            setSelectedSlotId(null)
        }
    }, [slots])

    const productTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + parseFloat(String(item.product.price_with_tax ?? item.product.price)) * Number(item.quantity), 0)
    }, [cart])

    const shippingFee = deliveryType === DeliverySlotType.HOME ? 400 : 0
    const grandTotal = productTotal + shippingFee

    const mutation = useMutation<ConsumerOrder, unknown, ConsumerOrderCreateRequest>({
        mutationFn: async (payload: ConsumerOrderCreateRequest) => {
            const response = await consumerOrderApi.create(payload)
            return response.data as ConsumerOrder
        },
        onSuccess: (order) => {
            toast.success('注文を受け付けました')
            clearCart()
            navigate(`/local/order-complete/${order.id}`)
        },
        onError: (error) => {
            console.error('Consumer order failed', error)
            const message = (error as any)?.response?.data?.detail ?? '注文の確定に失敗しました'
            toast.error(message)
        }
    })

    const handleSubmit = () => {
        if (!consumer) {
            toast.error('会員情報が取得できませんでした')
            return
        }

        if (cart.length === 0) {
            toast.error('カートに商品がありません')
            return
        }

        if (!selectedSlotId) {
            toast.error('受取枠を選択してください')
            return
        }

        const items = cart.map(item => ({
            product_id: item.product.id,
            quantity: Number(item.quantity),
        }))

        mutation.mutate({
            consumer_id: consumer.id,
            delivery_slot_id: selectedSlotId,
            delivery_address: deliveryType === DeliverySlotType.HOME ? overrideAddress.trim() : undefined,
            delivery_notes: deliveryNotes || undefined,
            order_notes: orderNotes || undefined,
            items,
        })
    }

    if (!consumer) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-600">
                    会員情報を取得しています...
                </div>
            </div>
        )
    }

    if (cart.length === 0) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-10 space-y-4 text-center">
                <div className="bg-white border border-gray-200 rounded-xl p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">カートが空です</h2>
                    <p className="text-gray-600">商品一覧からお好きな野菜を選んでください。</p>
                </div>
                <button
                    onClick={() => navigate('/local')}
                    className="inline-flex items-center justify-center px-5 py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700"
                >
                    商品一覧へ戻る
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">受取方法</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setDeliveryType(DeliverySlotType.HOME)}
                        className={`rounded-xl border p-4 text-left space-y-1 ${deliveryType === DeliverySlotType.HOME ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-200'}`}
                    >
                        <p className="font-semibold text-gray-900">自宅へ配送</p>
                        <p className="text-sm text-gray-600">送料400円 / 指定時間帯にお届けします</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setDeliveryType(DeliverySlotType.UNIVERSITY)}
                        className={`rounded-xl border p-4 text-left space-y-1 ${deliveryType === DeliverySlotType.UNIVERSITY ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}
                    >
                        <p className="font-semibold text-gray-900">兵庫県立大学 正門受取</p>
                        <p className="text-sm text-gray-600">無料 / 指定時刻にお受け取りください</p>
                    </button>
                </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">受取日時</h2>
                {isSlotsLoading && <p className="text-sm text-gray-600">受取枠を読み込み中です...</p>}
                {!isSlotsLoading && slots.length === 0 && (
                    <p className="text-sm text-red-600">現在選択可能な受取枠がありません。時間をおいて再度お試しください。</p>
                )}
                <div className="space-y-3">
                    {slots.map((slot) => (
                        <label key={slot.id} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:border-emerald-300 cursor-pointer">
                            <input
                                type="radio"
                                name="delivery_slot"
                                value={slot.id}
                                checked={selectedSlotId === slot.id}
                                onChange={() => setSelectedSlotId(slot.id)}
                                className="h-4 w-4 text-emerald-600"
                            />
                            <div>
                                <p className="font-semibold text-gray-900">{slot.slot_type === DeliverySlotType.HOME ? '自宅配送' : '大学受取'}</p>
                                <p className="text-sm text-gray-600">{formatSlotLabel(slot)}</p>
                            </div>
                        </label>
                    ))}
                </div>
            </section>

            {deliveryType === DeliverySlotType.HOME && (
                <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">配送先住所</h2>
                    <p className="text-xs text-gray-500">建物名・部屋番号が無い場合は「なし」とご記入ください。必要に応じて住所を修正できます。</p>
                    <textarea
                        value={overrideAddress}
                        onChange={(e) => setOverrideAddress(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </section>
            )}

            <section className="bg-white border border-gray-200 rounded-xl p-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">ご要望など</h2>
                    <textarea
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="インターホンが鳴らない場合はお電話ください など"
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">注文メモ</h2>
                    <textarea
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="のしが必要です など"
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">注文内容の確認</h2>
                <div className="space-y-2">
                    {cart.map(item => (
                        <div key={item.product.id} className="flex justify-between text-sm text-gray-700">
                            <span>{item.product.name} × {item.quantity}{item.product.unit}</span>
                            <span>¥{Math.round(parseFloat(String(item.product.price_with_tax ?? item.product.price)) * Number(item.quantity)).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
                <div className="border-t border-gray-200 pt-4 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                        <span>商品合計</span>
                        <span>¥{Math.round(productTotal).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>送料</span>
                        <span>{shippingFee === 0 ? '無料' : `¥${shippingFee.toLocaleString()}`}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg text-gray-900">
                        <span>お支払い合計</span>
                        <span>¥{Math.round(grandTotal).toLocaleString()}</span>
                    </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-lg p-4">
                    <p>お支払いは受取時の現金のみです。お釣りが出ないよう小銭をご準備ください。</p>
                </div>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={mutation.isPending || !selectedSlotId || (deliveryType === DeliverySlotType.HOME && !overrideAddress.trim())}
                    className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 disabled:opacity-60"
                >
                    {mutation.isPending ? '注文処理中...' : '注文を確定する'}
                </button>
            </section>
        </div>
    )
}

export default LocalCart
