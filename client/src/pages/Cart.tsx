/**
 * Cart Page - カート・注文作成
 * 配送日時指定と注文確定
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { DeliveryTimeSlot, type OrderCreateRequest } from '@/types'
import { Trash2, ShoppingCart, Calendar, Clock, MapPin } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'

export default function Cart() {
  const navigate = useNavigate()
  const { cart, getCartTotal, updateCartQuantity, removeFromCart, clearCart, restaurant } = useStore()
  
  // Delivery details
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<DeliveryTimeSlot | ''>('')
  const [deliveryNotes, setDeliveryNotes] = useState('')

  // Generate next 7 days for delivery date selection
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i + 1) // Start from tomorrow
    return {
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'M月d日(E)', { locale: ja }),
    }
  })

  const timeSlots: { value: DeliveryTimeSlot; label: string }[] = [
    { value: DeliveryTimeSlot.SLOT_12_14, label: '12:00 〜 14:00' },
    { value: DeliveryTimeSlot.SLOT_14_16, label: '14:00 〜 16:00' },
    { value: DeliveryTimeSlot.SLOT_16_18, label: '16:00 〜 18:00' },
  ]

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

    const orderData: OrderCreateRequest = {
      restaurant_id: restaurant.id,
      delivery_date: `${deliveryDate}T00:00:00+09:00`,
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
    return sum + parseFloat(item.product.price) * item.quantity
  }, 0)

  const totalWithTax = getCartTotal()

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">カートは空です</h2>
          <p className="text-gray-600 mb-6">商品を追加してください</p>
          <button onClick={() => navigate('/catalog')} className="btn-primary">
            野菜一覧へ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">カート</h1>
            <button onClick={() => navigate('/catalog')} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              買い物を続ける
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">注文商品</h2>
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex gap-4 border-b pb-4 last:border-b-0">
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold">{item.product.name}</h3>
                      <p className="text-sm text-gray-600">
                        ¥{parseFloat(item.product.price_with_tax).toLocaleString()} / {item.product.unit}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          -
                        </button>
                        <span className="px-3 py-1 bg-gray-100 rounded font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="ml-auto text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        ¥{(parseFloat(item.product.price_with_tax) * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Details */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                配送情報
              </h2>
              
              {/* Delivery Date */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  配送希望日 *
                </label>
                <select
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">日付を選択してください</option>
                  {availableDates.map((date) => (
                    <option key={date.value} value={date.value}>
                      {date.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Time Slot */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  配送時間帯 *
                </label>
                <div className="space-y-2">
                  {timeSlots.map((slot) => (
                    <label
                      key={slot.value}
                      className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="timeSlot"
                        value={slot.value}
                        checked={deliveryTimeSlot === slot.value}
                        onChange={(e) => setDeliveryTimeSlot(e.target.value as DeliveryTimeSlot)}
                        className="mr-3"
                      />
                      <span className="font-medium">{slot.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Delivery Address */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  配送先住所
                </label>
                <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded border">
                  {restaurant?.address || '住所が登録されていません'}
                </p>
              </div>

              {/* Delivery Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  配送メモ (任意)
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="例: 裏口から納品してください"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="card sticky top-20">
              <h2 className="text-xl font-bold mb-4">注文内容</h2>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">小計 (税抜)</span>
                  <span className="font-medium">¥{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">消費税</span>
                  <span className="font-medium">¥{(totalWithTax - subtotal).toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-lg font-bold">合計 (税込)</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ¥{totalWithTax.toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={!deliveryDate || !deliveryTimeSlot || createOrderMutation.isPending}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createOrderMutation.isPending ? '注文中...' : '注文を確定する'}
              </button>

              <p className="text-xs text-gray-500 mt-4 text-center">
                注文確定後、Refarm担当者が内容を確認し発送いたします
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
