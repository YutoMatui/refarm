/**
 * Cart Page - カート・注文作成
 * 配送日時指定と注文確定
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { settingsApi } from '@/services/api'
import { DeliveryTimeSlot, DeliverySettings, type OrderCreateRequest } from '@/types'
import { Trash2, ShoppingCart, Calendar, MapPin, ChevronLeft } from 'lucide-react'
import { format, addDays } from 'date-fns'
import DeliveryCalendar from '@/components/DeliveryCalendar'

export default function Cart() {
  const navigate = useNavigate()
  const { cart, getCartTotal, updateCartQuantity, removeFromCart, clearCart, restaurant } = useStore()

  // Delivery details
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<DeliveryTimeSlot | ''>('')
  const [deliveryNotes, setDeliveryNotes] = useState('')

  // Delivery Settings
  const { data: settings } = useQuery<DeliverySettings>({
    queryKey: ['delivery-settings'],
    queryFn: async () => {
      try {
        const res = await settingsApi.getDeliverySettings();
        return res.data;
      } catch {
        return {
          allowed_days: [0, 1, 2, 3, 4, 5, 6],
          closed_dates: [],
          time_slots: [
            { id: '12-14', label: '12:00 〜 14:00', enabled: true },
            { id: '14-16', label: '14:00 〜 16:00', enabled: true },
            { id: '16-18', label: '16:00 〜 18:00', enabled: true },
          ]
        };
      }
    }
  });

  // Min date (3 days from now)
  const minDate = format(addDays(new Date(), 3), 'yyyy-MM-dd')

  const timeSlots = settings?.time_slots?.filter(s => s.enabled).map(s => ({
    value: s.id as DeliveryTimeSlot,
    label: s.label
  })) || [
      { value: DeliveryTimeSlot.SLOT_12_14, label: '12:00 〜 14:00' },
      { value: DeliveryTimeSlot.SLOT_14_16, label: '14:00 〜 16:00' },
      { value: DeliveryTimeSlot.SLOT_16_18, label: '16:00 〜 18:00' },
    ];

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: OrderCreateRequest) => {
      const response = await orderApi.create(orderData)
      return response.data
    },
    onSuccess: (order) => {
      clearCart()
      navigate(`/order-complete/${order.id}`)
    },
    onError: (error: any) => {
      console.error('Order creation failed:', error)
      alert(`注文に失敗しました: ${error.response?.data?.detail || error.message}`)
    },
  })

  const handleSubmitOrder = () => {
    if (!restaurant) {
      alert('飲食店情報が見つかりません')
      return
    }

    if (!deliveryDate || !deliveryTimeSlot) {
      alert('配送日と時間帯を選択してください')
      return
    }

    // Ensure date is ISO format with timezone
    const isoDate = new Date(deliveryDate).toISOString()

    const orderData: OrderCreateRequest = {
      restaurant_id: restaurant.id,
      delivery_date: isoDate,
      delivery_time_slot: deliveryTimeSlot,
      delivery_address: restaurant.address,
      delivery_phone: restaurant.phone_number,
      delivery_notes: deliveryNotes || undefined,
      items: cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      })),
    }

    createOrderMutation.mutate(orderData)
  }

  const subtotal = cart.reduce((sum, item) => {
    return sum + parseFloat(item.product.price) * Number(item.quantity)
  }, 0)

  const totalWithTax = getCartTotal()

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">カートは空です</h2>
          <p className="text-gray-500 mb-8">商品を追加して、注文を作成しましょう</p>
          <button onClick={() => navigate('/products')} className="btn-primary w-full max-w-xs">
            野菜一覧へ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b px-4 h-14 flex items-center">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold ml-2">カート</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* Cart Items */}
        <div className="space-y-4">
          {cart.map((item) => (
            <div key={item.product.id} className="bg-white p-4 rounded-xl shadow-sm flex gap-4">
              {item.product.image_url && (
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className="w-20 h-20 object-cover rounded-lg bg-gray-100"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{item.product.name}</h3>
                <p className="text-sm text-gray-500 mb-2">
                  ¥{parseFloat(item.product.price_with_tax).toLocaleString()} / {item.product.unit}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                    <button
                      onClick={() => updateCartQuantity(item.product.id, Number(item.quantity) - 1)}
                      className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-gray-600"
                    >
                      -
                    </button>
                    <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQuantity(item.product.id, Number(item.quantity) + 1)}
                      className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-gray-600"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-gray-400 hover:text-red-500 p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Delivery Details */}
        <div className="bg-white p-5 rounded-xl shadow-sm space-y-6">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            配送日時指定
          </h2>

          {/* Delivery Date (Calendar) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              配送希望日 <span className="text-red-500">*</span>
            </label>
            <DeliveryCalendar
              selectedDate={deliveryDate}
              onSelect={setDeliveryDate}
              allowedDays={settings?.allowed_days || []}
              closedDates={settings?.closed_dates || []}
              minDate={minDate}
            />
            <p className="text-xs text-gray-500 mt-2">※3日後以降の日付を選択してください（○：可能、/：不可）</p>
          </div>

          {/* Delivery Time Slot */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              配送時間帯 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {timeSlots.map((slot) => (
                <label
                  key={slot.value}
                  className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${deliveryTimeSlot === slot.value
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <input
                    type="radio"
                    name="timeSlot"
                    value={slot.value}
                    checked={deliveryTimeSlot === slot.value}
                    onChange={(e) => setDeliveryTimeSlot(e.target.value as DeliveryTimeSlot)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 font-medium text-gray-900">{slot.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              配送先住所
            </label>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-sm text-gray-600 flex gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{restaurant?.address || '住所が登録されていません'}</span>
            </div>
          </div>

          {/* Delivery Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              配送メモ (任意)
            </label>
            <textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="例: 裏口から納品してください"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              rows={3}
            />
          </div>
        </div>

        {/* Total & Submit */}
        <div className="bg-white p-5 rounded-xl shadow-sm space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>小計 (税抜)</span>
              <span>¥{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>消費税</span>
              <span>¥{(totalWithTax - subtotal).toLocaleString()}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-baseline">
              <span className="font-bold text-gray-900">合計 (税込)</span>
              <span className="text-2xl font-bold text-blue-600">
                ¥{totalWithTax.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={!deliveryDate || !deliveryTimeSlot || createOrderMutation.isPending}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {createOrderMutation.isPending ? '注文を送信中...' : '注文を確定する'}
          </button>
        </div>
      </div>
    </div>
  )
}
