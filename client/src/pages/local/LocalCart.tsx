import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'
import { toast } from 'sonner'
import { MapPin, CreditCard, User, Calendar } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { consumerOrderApi, consumerApi, paymentApi, deliverySlotApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { DeliverySlotType, type ConsumerOrder, type ConsumerOrderCreateRequest, type DeliverySlot } from '@/types'
import AvailabilityModal from '@/components/AvailabilityModal'

// Stripe公開キーの初期化（バックエンドから取得）
let stripePromise: ReturnType<typeof loadStripe> | null = null
const getStripe = async () => {
    if (!stripePromise) {
        try {
            const res = await paymentApi.getConfig()
            stripePromise = loadStripe(res.data.publishable_key)
        } catch {
            console.error('Failed to load Stripe config')
            stripePromise = null
        }
    }
    return stripePromise
}

// --- Stripe決済フォーム（Elements内で使用） ---
interface CheckoutFormProps {
    onPaymentSuccess: (paymentIntentId: string, paymentMethodId: string) => void
    isSubmitting: boolean
}

const CheckoutForm = ({ onPaymentSuccess, isSubmitting }: CheckoutFormProps) => {
    const stripe = useStripe()
    const elements = useElements()
    const [isProcessing, setIsProcessing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleSubmit = async () => {
        if (!stripe || !elements) return

        setIsProcessing(true)
        setErrorMessage(null)

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: 'if_required',
        })

        if (error) {
            setErrorMessage(error.message ?? 'カード決済に失敗しました')
            setIsProcessing(false)
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            onPaymentSuccess(paymentIntent.id, paymentIntent.payment_method as string)
        } else {
            setErrorMessage('決済処理を完了できませんでした')
            setIsProcessing(false)
        }
    }

    return (
        <div className="space-y-3">
            <PaymentElement options={{ layout: 'tabs' }} />
            {errorMessage && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{errorMessage}</div>
            )}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={!stripe || isProcessing || isSubmitting}
                className="w-full py-4 bg-emerald-600 text-white font-bold text-lg rounded-xl hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
                {isProcessing || isSubmitting ? '決済処理中...' : '注文を確定する'}
            </button>
        </div>
    )
}

// --- メインカートコンポーネント ---
const LocalCart = () => {
    const navigate = useNavigate()
    const cart = useStore(state => state.cart)
    const consumer = useStore(state => state.consumer)
    const setConsumer = useStore(state => state.setConsumer)
    const clearCart = useStore(state => state.clearCart)

    // プロフィール未完了の場合の入力フィールド
    const needsProfile = !consumer?.name || !consumer?.phone_number
    const [profileName, setProfileName] = useState(consumer?.name || '')
    const [profilePhone, setProfilePhone] = useState(consumer?.phone_number || '')
    const [isProfileSubmitting, setIsProfileSubmitting] = useState(false)

    const handleProfileComplete = async () => {
        if (!profileName.trim() || !profilePhone.trim()) {
            toast.error('お名前と電話番号を入力してください')
            return
        }
        setIsProfileSubmitting(true)
        try {
            const response = await consumerApi.completeProfile({
                name: profileName.trim(),
                phone_number: profilePhone.trim(),
            })
            setConsumer(response.data)
            toast.success('プロフィールを登録しました')
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'プロフィール登録に失敗しました')
        } finally {
            setIsProfileSubmitting(false)
        }
    }

    const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
    const [deliveryDate, setDeliveryDate] = useState('')
    const [deliveryTimeLabel, setDeliveryTimeLabel] = useState('')
    const [deliveryNotes, setDeliveryNotes] = useState('')

    // Stripe
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [stripeInstance, setStripeInstance] = useState<Awaited<ReturnType<typeof loadStripe>> | null>(null)
    const [stripeError, setStripeError] = useState<string | null>(null)

    const [isAvailModalOpen, setIsAvailModalOpen] = useState(false)
    const [unavailableItems] = useState<any[]>([])
    const [nextDateSuggestion] = useState<{ date: string; label: string } | undefined>()

    const minDate = format(addDays(new Date(), 2), 'yyyy-MM-dd')

    // --- 消費者向けの受取枠をAPI取得 ---
    const { data: universitySlots } = useQuery({
        queryKey: ['consumer-delivery-slots-public'],
        queryFn: async () => {
            const res = await deliverySlotApi.list({ slot_type: DeliverySlotType.UNIVERSITY })
            return res.data
        },
    })

    // 受取枠がある日付だけ抽出（minDate以降）
    const availableDates = useMemo(() => {
        if (!universitySlots) return []
        return [...new Set(
            universitySlots
                .filter((s: DeliverySlot) => s.is_active && s.date >= minDate)
                .map((s: DeliverySlot) => s.date)
        )].sort()
    }, [universitySlots, minDate])

    // 選択された日の時間帯
    const timeSlotsForDate = useMemo(() => {
        if (!universitySlots || !deliveryDate) return []
        return universitySlots.filter(
            (s: DeliverySlot) => s.date === deliveryDate && s.is_active && s.slot_type === DeliverySlotType.UNIVERSITY
        )
    }, [universitySlots, deliveryDate])

    // 日付変更時にスロット選択をリセット
    useEffect(() => {
        setSelectedSlotId(null)
        setDeliveryTimeLabel('')
    }, [deliveryDate])

    // --- Stripe初期化 ---
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

    const grandTotal = productTotal

    // PaymentIntentを作成（金額が決まったとき）
    useEffect(() => {
        if (grandTotal <= 0 || needsProfile) return
        let cancelled = false

        const createIntent = async () => {
            setStripeError(null)
            try {
                const stripe = await getStripe()
                if (cancelled) return
                if (!stripe) {
                    setStripeError('Stripeの初期化に失敗しました。公開キーを確認してください。')
                    return
                }
                setStripeInstance(stripe)

                const res = await paymentApi.createPaymentIntent({ amount: grandTotal, save_card: false })
                if (!cancelled) {
                    setClientSecret(res.data.client_secret)
                }
            } catch (err: any) {
                console.error('PaymentIntent creation failed', err)
                const detail = err?.response?.data?.detail || err?.message || '決済の初期化に失敗しました'
                if (!cancelled) setStripeError(detail)
            }
        }

        createIntent()
        return () => { cancelled = true }
    }, [grandTotal, needsProfile])

    // --- 注文送信 ---
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

    const handlePaymentSuccess = (paymentIntentId: string, paymentMethodId: string) => {
        if (!consumer) return

        const items = cart.map(item => ({
            product_id: item.product.id,
            quantity: Number(item.quantity),
        }))

        mutation.mutate({
            consumer_id: consumer.id,
            delivery_slot_id: selectedSlotId ?? undefined,
            delivery_date: deliveryDate,
            delivery_time_label: deliveryTimeLabel,
            delivery_type: DeliverySlotType.UNIVERSITY,
            delivery_notes: deliveryNotes || undefined,
            payment_method: 'card',
            save_card_for_future: false,
            stripe_payment_method_id: paymentMethodId,
            stripe_payment_intent_id: paymentIntentId,
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

    const formatDateLabel = (dateStr: string) => {
        try {
            return format(new Date(dateStr + 'T00:00:00'), 'M月d日(E)', { locale: ja })
        } catch {
            return dateStr
        }
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

    const canSubmit = !!deliveryDate && !!selectedSlotId && !needsProfile

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">
            {needsProfile && (
                <section className="bg-white border-2 border-amber-400 rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <User className="text-amber-600" size={20} />
                        お客様情報の入力
                    </h2>
                    <p className="text-sm text-gray-600">注文にはお名前と電話番号が必要です。</p>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">お名前 <span className="text-red-500">*</span></label>
                            <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)}
                                placeholder="例）山田 太郎"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">電話番号 <span className="text-red-500">*</span></label>
                            <input type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)}
                                placeholder="例）08012345678"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <button type="button" onClick={handleProfileComplete}
                            disabled={isProfileSubmitting || !profileName.trim() || !profilePhone.trim()}
                            className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed">
                            {isProfileSubmitting ? '登録中...' : '登録して注文に進む'}
                        </button>
                    </div>
                </section>
            )}

            {/* 受取場所 */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="text-emerald-600" size={20} />
                    受取場所
                </h2>
                <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-5 space-y-2">
                    <p className="font-bold text-gray-900">📍 ユニバードーム付近で受取</p>
                    <p className="text-sm text-gray-600">送料無料</p>
                </div>
            </section>

            {/* 受取日を選択（管理画面で設定した日付のみ） */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="text-emerald-600" size={20} />
                    受取日を選択
                </h2>
                {availableDates.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableDates.map(date => (
                            <button
                                key={date}
                                type="button"
                                onClick={() => setDeliveryDate(date)}
                                className={`p-3 rounded-xl border-2 text-center font-medium transition-all ${
                                    deliveryDate === date
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 hover:border-emerald-200 text-gray-700'
                                }`}
                            >
                                {formatDateLabel(date)}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-gray-500">
                        <p>現在、受取可能な日程がありません。</p>
                        <p className="text-xs mt-1">管理者が受取枠を設定するとここに表示されます。</p>
                    </div>
                )}
            </section>

            {/* 時間帯を選択（選択日の受取枠から） */}
            {deliveryDate && (
                <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">時間帯を選択</h2>
                    {timeSlotsForDate.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {timeSlotsForDate.map((slot: DeliverySlot) => (
                                <label
                                    key={slot.id}
                                    className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${
                                        selectedSlotId === slot.id
                                            ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                            : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="timeSlot"
                                        value={slot.id}
                                        checked={selectedSlotId === slot.id}
                                        onChange={() => {
                                            setSelectedSlotId(slot.id)
                                            setDeliveryTimeLabel(slot.time_text)
                                        }}
                                        className="w-4 h-4 text-emerald-600 border-gray-300"
                                    />
                                    <span className="ml-3 font-medium text-gray-900">{slot.time_text}</span>
                                    {slot.note && <span className="ml-2 text-xs text-gray-400">({slot.note})</span>}
                                </label>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-4">この日の時間帯は設定されていません。</p>
                    )}
                </section>
            )}

            {/* ご要望 */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900">ご要望など（任意）</h2>
                <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="連絡事項があればご記入ください"
                    rows={2}
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
                        <span className="text-emerald-600 font-semibold">無料</span>
                    </div>
                    <div className="flex justify-between font-bold text-xl text-gray-900 pt-2 border-t-2 border-gray-300">
                        <span>お支払い合計</span>
                        <span className="text-emerald-600">¥{grandTotal.toLocaleString()}</span>
                    </div>
                </div>
            </section>

            {/* Stripe決済 */}
            <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <CreditCard className="text-emerald-600" size={20} />
                    お支払い（クレジットカード）
                </h2>
                <p className="text-sm text-gray-600">カード情報はStripeで安全に処理され、当サービスでは保持しません。</p>

                {!canSubmit && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500 text-center">
                        受取日と時間帯を選択するとカード入力フォームが表示されます
                    </div>
                )}

                {canSubmit && stripeError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                        <p className="font-semibold mb-1">決済エラー</p>
                        <p>{stripeError}</p>
                    </div>
                )}

                {canSubmit && !stripeError && clientSecret && stripeInstance ? (
                    <Elements stripe={stripeInstance} options={{
                        clientSecret,
                        appearance: {
                            theme: 'stripe',
                            variables: { colorPrimary: '#059669', borderRadius: '8px' },
                        },
                        locale: 'ja',
                    }}>
                        <CheckoutForm
                            onPaymentSuccess={handlePaymentSuccess}
                            isSubmitting={mutation.isPending}
                        />
                    </Elements>
                ) : canSubmit && !stripeError ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                        決済フォームを読み込んでいます...
                    </div>
                ) : null}
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
