import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, addDays, parseISO, isAfter } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'sonner'
import { MapPin, CreditCard, Wallet } from 'lucide-react'
import { consumerOrderApi, farmerApi, settingsApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { DeliveryTimeSlot, DeliverySlotType, type ConsumerOrder, type ConsumerOrderCreateRequest, type DeliverySchedule } from '@/types'
import DeliveryCalendar from '@/components/DeliveryCalendar'
import AvailabilityModal from '@/components/AvailabilityModal'

type ConsumerPaymentMethod = 'cash_on_delivery' | 'card'

const LocalCart = () => {
    const navigate = useNavigate()
    const cart = useStore(state => state.cart)
    const consumer = useStore(state => state.consumer)
    const clearCart = useStore(state => state.clearCart)

    const [deliveryDestination, setDeliveryDestination] = useState<'UNIV' | 'HOME'>('UNIV')
    const [deliveryDate, setDeliveryDate] = useState('')
    const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<DeliveryTimeSlot | ''>('')
    const [deliveryNotes, setDeliveryNotes] = useState('')
    const [overrideAddress, setOverrideAddress] = useState('')
    const [availableTimeSlots, setAvailableTimeSlots] = useState<{ value: DeliveryTimeSlot; label: string }[]>([])

    const [paymentMethod, setPaymentMethod] = useState<ConsumerPaymentMethod>('cash_on_delivery')
    const [saveCardForFuture, setSaveCardForFuture] = useState(false)
    const [stripeCustomerId, setStripeCustomerId] = useState('')
    const [stripePaymentMethodId, setStripePaymentMethodId] = useState('')
    const [stripePaymentIntentId, setStripePaymentIntentId] = useState('')

    const [isAvailModalOpen, setIsAvailModalOpen] = useState(false)
    const [unavailableItems, setUnavailableItems] = useState<any[]>([])
    const [nextDateSuggestion, setNextDateSuggestion] = useState<{ date: string; label: string } | undefined>()

    const defaultTimeSlots = [
        { value: DeliveryTimeSlot.SLOT_12_14, label: '12:00 〜 14:00' },
        { value: DeliveryTimeSlot.SLOT_14_16, label: '14:00 〜 16:00' },
        { value: DeliveryTimeSlot.SLOT_16_18, label: '16:00 〜 18:00' },
    ]

    const minDate = format(addDays(new Date(), 2), 'yyyy-MM-dd')

    useEffect(() => {
        if (consumer && deliveryDestination === 'HOME') {
            const baseAddress = `${consumer.address ?? ''}${consumer.building ? ` ${consumer.building}` : ''}`
            setOverrideAddress(baseAddress.trim())
        }
    }, [consumer, deliveryDestination])

    useEffect(() => {
        if (!consumer) return
        setStripeCustomerId(consumer.stripe_customer_id ?? '')
        setStripePaymentMethodId(consumer.default_stripe_payment_method_id ?? '')
    }, [consumer])

    const { data: settings } = useQuery({
        queryKey: ['delivery-settings'],
        queryFn: async () => {
            try {
                const res = await settingsApi.getDeliverySettings()
                return res.data
            } catch {
                return {
                    allowed_days: [0, 1, 2, 3, 4, 5, 6],
                    closed_dates: [],
                    time_slots: [
                        { id: '12-14', label: '12:00 〜 14:00', enabled: true },
                        { id: '14-16', label: '14:00 〜 16:00', enabled: true },
                        { id: '16-18', label: '16:00 〜 18:00', enabled: true },
                    ],
                }
            }
        },
    })

    useEffect(() => {
        if (settings) {
            const slots = settings.time_slots?.filter(s => s.enabled).map(s => ({
                value: s.id as DeliveryTimeSlot,
                label: s.label,
            })) || defaultTimeSlots
            setAvailableTimeSlots(slots)
            return
        }
        setAvailableTimeSlots(defaultTimeSlots)
    }, [settings])

    const uniqueFarmerIds = useMemo(() => {
        return Array.from(new Set(
            cart
                .map(item => item.product.farmer_id)
                .filter(id => id !== undefined && id !== null && id !== 0)
        )) as number[]
    }, [cart])

    const { data: bulkAvailability } = useQuery({
        queryKey: ['farmer-availability-bulk-local', format(new Date(), 'yyyy-MM'), uniqueFarmerIds],
        queryFn: async () => {
            if (uniqueFarmerIds.length === 0) return null
            const start = format(new Date(), 'yyyy-MM-dd')
            const end = format(addDays(new Date(), 30), 'yyyy-MM-dd')
            const res = await farmerApi.checkAvailabilityBulk({
                farmer_ids: uniqueFarmerIds,
                start_date: start,
                end_date: end,
            })
            return res.data
        },
        enabled: uniqueFarmerIds.length > 0,
    })

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
        },
    })

    const handleDateSelect = async (date: string, schedule?: DeliverySchedule) => {
        setDeliveryDate(date)
        setDeliveryTimeSlot('')

        if (uniqueFarmerIds.length > 0) {
            const badItems: any[] = []
            for (const farmerId of uniqueFarmerIds) {
                try {
                    const res = await farmerApi.checkAvailability(farmerId, date)
                    if (!res.data.is_available) {
                        const product = cart.find(item => item.product.farmer_id === farmerId)?.product
                        badItems.push({
                            productName: product?.name || '商品',
                            farmerName: product?.farmer?.name || '農家',
                            reason: res.data.reason || '出荷不可',
                            productId: product?.id,
                            farmerId,
                        })
                    }
                } catch (e) {
                    console.error('Selection check failed', e)
                }
            }

            if (badItems.length > 0) {
                setUnavailableItems(badItems)
                if (bulkAvailability) {
                    const today = new Date()
                    const dates = Object.keys(bulkAvailability).sort()
                    const nextComplete = dates.find(d => {
                        const dObj = new Date(d)
                        return isAfter(dObj, today) && bulkAvailability[d].all_available
                    })
                    if (nextComplete) {
                        setNextDateSuggestion({
                            date: nextComplete,
                            label: format(parseISO(nextComplete), 'M月d日(E)', { locale: ja }),
                        })
                    }
                }
                setIsAvailModalOpen(true)
            }
        }

        if (schedule && schedule.time_slot) {
            const slotsStr = schedule.time_slot.split(',')
            const validSlots: { value: DeliveryTimeSlot; label: string }[] = []

            slotsStr.forEach(slotStr => {
                let mappedSlot: DeliveryTimeSlot | null = null
                if (slotStr.includes('12') && slotStr.includes('14')) mappedSlot = DeliveryTimeSlot.SLOT_12_14
                else if (slotStr.includes('14') && slotStr.includes('16')) mappedSlot = DeliveryTimeSlot.SLOT_14_16
                else if (slotStr.includes('16') && slotStr.includes('18')) mappedSlot = DeliveryTimeSlot.SLOT_16_18

                if (mappedSlot && !validSlots.some(s => s.value === mappedSlot)) {
                    validSlots.push({ value: mappedSlot, label: slotStr.trim() })
                }
            })

            if (validSlots.length > 0) {
                setAvailableTimeSlots(validSlots)
                return
            }
        }

        const slots = settings?.time_slots?.filter(s => s.enabled).map(s => ({
            value: s.id as DeliveryTimeSlot,
            label: s.label,
        })) || defaultTimeSlots
        setAvailableTimeSlots(slots)
    }

    const handleSubmit = async () => {
        if (!consumer) {
            toast.error('会員情報が取得できませんでした')
            return
        }
        if (cart.length === 0) {
            toast.error('カートに商品がありません')
            return
        }
        if (!deliveryDate || !deliveryTimeSlot) {
            toast.error('受取日と時間帯を選択してください')
            return
        }
        if (deliveryDestination === 'HOME' && !overrideAddress.trim()) {
            toast.error('配送先住所を入力してください')
            return
        }
        if (paymentMethod === 'card' && !stripePaymentMethodId.trim()) {
            toast.error('カード決済にはStripe PaymentMethod IDが必要です')
            return
        }
        if (paymentMethod === 'card' && saveCardForFuture && !stripeCustomerId.trim()) {
            toast.error('カード保存にはStripe Customer IDが必要です')
            return
        }

        if (uniqueFarmerIds.length > 0) {
            const badItems: any[] = []
            for (const farmerId of uniqueFarmerIds) {
                try {
                    const res = await farmerApi.checkAvailability(farmerId, deliveryDate)
                    if (!res.data.is_available) {
                        const product = cart.find(item => item.product.farmer_id === farmerId)?.product
                        badItems.push({
                            productName: product?.name || '商品',
                            farmerName: product?.farmer?.name || '農家',
                            reason: res.data.reason || '出荷不可',
                            productId: product?.id,
                            farmerId,
                        })
                    }
                } catch (e) {
                    console.error('Availability check failed', e)
                    toast.error('出荷状況を確認できませんでした')
                    return
                }
            }

            if (badItems.length > 0) {
                setUnavailableItems(badItems)
                if (bulkAvailability) {
                    const today = new Date()
                    const dates = Object.keys(bulkAvailability).sort()
                    const nextComplete = dates.find(d => {
                        const dObj = new Date(d)
                        return isAfter(dObj, today) && bulkAvailability[d].all_available
                    })

                    if (nextComplete) {
                        setNextDateSuggestion({
                            date: nextComplete,
                            label: format(parseISO(nextComplete), 'M月d日(E)', { locale: ja }),
                        })
                    }
                }
                setIsAvailModalOpen(true)
                return
            }
        }

        const selectedTimeLabel = availableTimeSlots.find(slot => slot.value === deliveryTimeSlot)?.label ?? String(deliveryTimeSlot)
        const items = cart.map(item => ({
            product_id: item.product.id,
            quantity: Number(item.quantity),
        }))

        mutation.mutate({
            consumer_id: consumer.id,
            delivery_date: deliveryDate,
            delivery_time_label: selectedTimeLabel,
            delivery_type: deliveryDestination === 'HOME' ? DeliverySlotType.HOME : DeliverySlotType.UNIVERSITY,
            delivery_address: deliveryDestination === 'HOME' ? overrideAddress.trim() : undefined,
            delivery_notes: deliveryNotes || undefined,
            payment_method: paymentMethod,
            save_card_for_future: paymentMethod === 'card' ? saveCardForFuture : false,
            stripe_customer_id: paymentMethod === 'card' && stripeCustomerId.trim() ? stripeCustomerId.trim() : undefined,
            stripe_payment_method_id: paymentMethod === 'card' ? stripePaymentMethodId.trim() : undefined,
            stripe_payment_intent_id: paymentMethod === 'card' && stripePaymentIntentId.trim() ? stripePaymentIntentId.trim() : undefined,
            items,
        })
    }

    const handleConsolidate = (date: string) => {
        setDeliveryDate(date)
        setIsAvailModalOpen(false)
    }

    const handleRemoveUnavailable = () => {
        const removeFromCart = useStore.getState().removeFromCart
        const idsToRemove = unavailableItems.map(item => item.productId)
        idsToRemove.forEach(id => removeFromCart(id))
        setIsAvailModalOpen(false)
    }

    const { subtotal, taxAmount, productTotal } = useMemo(() => {
        let currentSubtotal = 0
        let currentTax = 0

        cart.forEach(item => {
            const price = parseFloat(String(item.product.price))
            const quantity = Number(item.quantity)
            const taxRate = item.product.tax_rate

            const itemSubtotal = price * quantity
            const itemTax = Math.round(itemSubtotal * (taxRate / 100))

            currentSubtotal += itemSubtotal
            currentTax += itemTax
        })

        return {
            subtotal: Math.round(currentSubtotal),
            taxAmount: Math.round(currentTax),
            productTotal: Math.round(currentSubtotal + currentTax),
        }
    }, [cart])

    const shippingFee = deliveryDestination === 'HOME' ? 500 : 0
    const grandTotal = productTotal + shippingFee

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
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="text-emerald-600" size={20} />
                    受取方法を選択
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
                        <p className="font-bold text-gray-900">📍 ピックアップステーション受取</p>
                        <p className="text-sm text-gray-600">受取場所: 正門前 / 送料0円</p>
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
                        <p className="text-sm text-gray-600">送料500円 / 指定時間帯にお届け</p>
                    </button>
                </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">お届け日を選択</h2>
                <p className="text-sm text-gray-600">飲食店向けと同じ配達可能日・時間ロジックで表示しています。</p>
                <DeliveryCalendar
                    selectedDate={deliveryDate}
                    onSelect={handleDateSelect}
                    minDate={minDate}
                    cart={cart}
                />
                <p className="text-xs text-gray-500">※2日後以降の日付を選択可能（○：揃う、△：一部不可、×：不可）</p>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">時間帯を選択</h2>
                <div className="grid grid-cols-1 gap-2">
                    {availableTimeSlots.map((slot) => (
                        <label
                            key={slot.value}
                            className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${deliveryTimeSlot === slot.value
                                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                : 'border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <input
                                type="radio"
                                name="timeSlot"
                                value={slot.value}
                                checked={deliveryTimeSlot === slot.value}
                                onChange={(e) => setDeliveryTimeSlot(e.target.value as DeliveryTimeSlot)}
                                className="w-4 h-4 text-emerald-600 border-gray-300"
                            />
                            <span className="ml-3 font-medium text-gray-900">{slot.label}</span>
                        </label>
                    ))}
                </div>
            </section>

            {deliveryDestination === 'HOME' && (
                <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">配送先住所</h2>
                    <textarea
                        value={overrideAddress}
                        onChange={(e) => setOverrideAddress(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </section>
            )}

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

            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">お支払い方法</h2>
                <p className="text-sm text-gray-600">カード情報の実データはStripeで管理し、当サービスでは保持しません。</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('cash_on_delivery')}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${paymentMethod === 'cash_on_delivery'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-amber-200'
                            }`}
                    >
                        <p className="font-semibold text-gray-900 flex items-center gap-2"><Wallet size={18} />受取時に現金</p>
                        <p className="text-xs text-gray-600 mt-1">これまで通りの現金決済です。</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${paymentMethod === 'card'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-200'
                            }`}
                    >
                        <p className="font-semibold text-gray-900 flex items-center gap-2"><CreditCard size={18} />クレジットカード</p>
                        <p className="text-xs text-gray-600 mt-1">Stripe連携で安全に決済します。</p>
                    </button>
                </div>

                {paymentMethod === 'card' && (
                    <div className="space-y-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                            本番ではこの領域に Stripe Elements（カード番号・有効期限・CVC）を配置します。
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={saveCardForFuture}
                                onChange={(e) => setSaveCardForFuture(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                            />
                            次回以降のためにカードを保存する（Stripe上）
                        </label>
                        <details className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <summary className="cursor-pointer text-sm font-semibold text-gray-800">開発用: Stripe ID入力（本番はElementsで自動化）</summary>
                            <div className="mt-3 space-y-2">
                                <input
                                    type="text"
                                    value={stripeCustomerId}
                                    onChange={(e) => setStripeCustomerId(e.target.value)}
                                    placeholder="cus_xxx（任意 / 保存時は必須）"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                                <input
                                    type="text"
                                    value={stripePaymentMethodId}
                                    onChange={(e) => setStripePaymentMethodId(e.target.value)}
                                    placeholder="pm_xxx（カード決済時は必須）"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                                <input
                                    type="text"
                                    value={stripePaymentIntentId}
                                    onChange={(e) => setStripePaymentIntentId(e.target.value)}
                                    placeholder="pi_xxx（任意）"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                            </div>
                        </details>
                    </div>
                )}
            </section>

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
                {paymentMethod === 'cash_on_delivery' ? (
                    <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-800 text-sm rounded-xl p-4">
                        <p className="font-semibold mb-1">💰 お支払いについて</p>
                        <p>お支払いは受取時の現金です。お釣りが出ないようご準備をお願いします。</p>
                    </div>
                ) : (
                    <div className="bg-blue-50 border-2 border-blue-200 text-blue-900 text-sm rounded-xl p-4">
                        <p className="font-semibold mb-1">💳 カード決済について</p>
                        <p>カード情報はStripeで安全に処理され、当サービスでは保持しません。</p>
                    </div>
                )}
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={mutation.isPending || !deliveryDate || !deliveryTimeSlot || (deliveryDestination === 'HOME' && !overrideAddress.trim())}
                    className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-xl hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                    {mutation.isPending ? '注文処理中...' : '注文を確定する'}
                </button>
            </section>

            <AvailabilityModal
                isOpen={isAvailModalOpen}
                onClose={() => setIsAvailModalOpen(false)}
                unavailableItems={unavailableItems}
                nextAvailableDate={nextDateSuggestion}
                onConsolidate={handleConsolidate}
                onRemoveUnavailable={handleRemoveUnavailable}
            />
        </div>
    )
}

export default LocalCart
