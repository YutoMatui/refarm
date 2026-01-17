import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'sonner'
import { MapPin, AlertCircle } from 'lucide-react'
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

    const [deliveryDestination, setDeliveryDestination] = useState<'UNIV' | 'HOME'>('UNIV')
    const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
    const [deliveryNotes, setDeliveryNotes] = useState('')
    const [overrideAddress, setOverrideAddress] = useState('')
    const [univLocationDetail, setUnivLocationDetail] = useState('')

    useEffect(() => {
        if (consumer && deliveryDestination === 'HOME') {
            const baseAddress = `${consumer.address}${consumer.building ? ` ${consumer.building}` : ''}`
            setOverrideAddress(baseAddress.trim())
        }
    }, [consumer, deliveryDestination])

    // 配送先に応じた受取枠を取得
    // HOME = 自宅配送用の枠、UNIV = 大学受取用の枠
    const { data: slotData, isLoading: isSlotsLoading } = useQuery<DeliverySlot[]>({
        queryKey: ['delivery-slots', deliveryDestination],
        queryFn: async () => {
            const slotType = deliveryDestination === 'UNIV' ? DeliverySlotType.UNIVERSITY : DeliverySlotType.HOME
            const response = await deliverySlotApi.list({ slot_type: slotType })
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

    // 税抜き小計と消費税を計算
    const { subtotal, taxAmount, productTotal } = useMemo(() => {
        let subtotal = 0
        let taxAmount = 0

        cart.forEach(item => {
            const price = parseFloat(String(item.product.price))
            const quantity = Number(item.quantity)
            const taxRate = item.product.tax_rate

            const itemSubtotal = price * quantity
            const itemTax = Math.round(itemSubtotal * (taxRate / 100))

            subtotal += itemSubtotal
            taxAmount += itemTax
        })

        return {
            subtotal: Math.round(subtotal),
            taxAmount: Math.round(taxAmount),
            productTotal: Math.round(subtotal + taxAmount)
        }
    }, [cart])

    const shippingFee = deliveryDestination === 'HOME' ? 400 : 0
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

        // 配送メモに受け取り場所詳細を含める
        let finalDeliveryNotes = deliveryNotes
        if (deliveryDestination === 'UNIV' && univLocationDetail.trim()) {
            finalDeliveryNotes = univLocationDetail.trim() + (deliveryNotes ? `\n${deliveryNotes}` : '')
        }

        mutation.mutate({
            consumer_id: consumer.id,
            delivery_slot_id: selectedSlotId,
            delivery_address: deliveryDestination === 'HOME' ? overrideAddress.trim() : undefined,
            delivery_notes: finalDeliveryNotes || undefined,
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
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
            {/* 受取方法 */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="text-emerald-600" size={20} />
                    受取場所を選択
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setDeliveryDestination('UNIV')}
                        className={`rounded-xl border-2 p-5 text-left space-y-2 transition-all ${deliveryDestination === 'UNIV'
                            ? 'border-emerald-500 bg-emerald-50 shadow-md'
                            : 'border-gray-200 hover:border-emerald-200'
                            }`}
                    >
                        <p className="font-bold text-gray-900">🏫 兵庫県立大学 受取</p>
                        <p className="text-sm text-gray-600">送料無料 / 指定時刻にお受け取り</p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                            <p className="text-xs text-blue-700 leading-relaxed">
                                <span className="font-semibold">学校関係者:</span> 校内受け取り（教室等）<br />
                                <span className="font-semibold">地域住民:</span> 正門前受け取り
                            </p>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setDeliveryDestination('HOME')}
                        className={`rounded-xl border-2 p-5 text-left space-y-2 transition-all ${deliveryDestination === 'HOME'
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-blue-200'
                            }`}
                    >
                        <p className="font-bold text-gray-900">🏠 自宅へ配送</p>
                        <p className="text-sm text-gray-600">送料400円 / 指定時間帯にお届け</p>
                    </button>
                </div>
            </section>

            {/* 受取日時 */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">受取日時を選択</h2>
                <p className="text-sm text-gray-600">
                    選択した受取場所（{deliveryDestination === 'UNIV' ? '🏫 大学受取' : '🏠 自宅配送'}）でご利用いただけます
                </p>
                {isSlotsLoading && <p className="text-sm text-gray-600">受取枠を読み込み中です...</p>}
                {!isSlotsLoading && slots.length === 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                        <p className="text-sm text-red-700">
                            現在選択可能な受取枠がありません。時間をおいて再度お試しください。
                        </p>
                    </div>
                )}
                <div className="space-y-3">
                    {slots.map((slot) => (
                        <label
                            key={slot.id}
                            className={`flex items-start space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedSlotId === slot.id
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-gray-200 hover:border-emerald-300'
                                }`}
                        >
                            <input
                                type="radio"
                                name="delivery_slot"
                                value={slot.id}
                                checked={selectedSlotId === slot.id}
                                onChange={() => setSelectedSlotId(slot.id)}
                                className="mt-1 h-4 w-4 text-emerald-600"
                            />
                            <div className="flex-1">
                                <p className="font-bold text-gray-900">{formatSlotLabel(slot)}</p>
                                {slot.note && (
                                    <p className="text-xs text-gray-500 mt-2 bg-gray-50 px-2 py-1 rounded">
                                        {slot.note}
                                    </p>
                                )}
                            </div>
                        </label>
                    ))}
                </div>
            </section>

            {/* 兵庫県立大学受け取り - 詳細指定 */}
            {deliveryDestination === 'UNIV' && (
                <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">受け取り場所の詳細（任意）</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <p className="text-sm text-blue-800 font-semibold flex items-center gap-2">
                            <AlertCircle size={16} />
                            学校関係者の方へ
                        </p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                            校内受け取りをご希望の場合は、建物名・階数・教室番号などを記入してください。<br />
                            例: 社会情報科学棟4階資料準備室、本部棟1階事務室 など
                        </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                        <p className="text-sm text-emerald-800 font-semibold flex items-center gap-2">
                            <MapPin size={16} />
                            地域住民の方へ
                        </p>
                        <p className="text-xs text-emerald-700 leading-relaxed">
                            正門前での受け取りをご希望の場合は、空欄のままで結構です。<br />
                            または「正門前」とご記入ください。
                        </p>
                    </div>
                    <textarea
                        value={univLocationDetail}
                        onChange={(e) => setUnivLocationDetail(e.target.value)}
                        placeholder="例: 社会情報科学棟4階資料準備室"
                        rows={2}
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </section>
            )}

            {/* 自宅配送 - 配送先住所 */}
            {deliveryDestination === 'HOME' && (
                <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">配送先住所</h2>
                    <p className="text-xs text-gray-500">
                        建物名・部屋番号が無い場合は「なし」とご記入ください。必要に応じて住所を修正できます。
                    </p>
                    <textarea
                        value={overrideAddress}
                        onChange={(e) => setOverrideAddress(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </section>
            )}

            {/* ご要望など */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">ご要望など（任意）</h2>
                <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="インターホンが鳴らない場合はお電話ください など"
                    rows={3}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
            </section>

            {/* 注文内容の確認 */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">注文内容の確認</h2>
                <div className="space-y-2">
                    {cart.map(item => {
                        const price = parseFloat(String(item.product.price))
                        const quantity = Number(item.quantity)
                        const taxRate = item.product.tax_rate
                        const itemSubtotal = Math.round(price * quantity)
                        const itemTax = Math.round(itemSubtotal * (taxRate / 100))
                        const itemTotal = itemSubtotal + itemTax

                        return (
                            <div key={item.product.id} className="flex justify-between text-sm text-gray-700 py-2 border-b border-gray-100">
                                <span className="font-medium">{item.product.name} × {item.quantity}{item.product.unit}</span>
                                <span className="font-semibold">¥{itemTotal.toLocaleString()}</span>
                            </div>
                        )
                    })}
                </div>
                <div className="border-t-2 border-gray-200 pt-4 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                        <span>小計（税抜）</span>
                        <span>¥{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>消費税</span>
                        <span>¥{taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
                        <span>商品合計（税込）</span>
                        <span>¥{productTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>送料</span>
                        <span className={shippingFee === 0 ? 'text-emerald-600 font-semibold' : ''}>
                            {shippingFee === 0 ? '無料' : `¥${shippingFee.toLocaleString()}`}
                        </span>
                    </div>
                    <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 border-t-2 border-gray-300">
                        <span>お支払い合計</span>
                        <span className="text-emerald-600">¥{grandTotal.toLocaleString()}</span>
                    </div>
                </div>
                <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-800 text-sm rounded-xl p-4">
                    <p className="font-semibold mb-1">💰 お支払いについて</p>
                    <p>お支払いは受取時の現金のみです。お釣りが出ないよう小銭をご準備ください。</p>
                </div>
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={mutation.isPending || !selectedSlotId || (deliveryDestination === 'HOME' && !overrideAddress.trim())}
                    className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-xl hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                    {mutation.isPending ? '注文処理中...' : '注文を確定する'}
                </button>
            </section>
        </div>
    )
}

export default LocalCart
