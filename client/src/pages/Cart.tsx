/**
 * Cart Page - カート・注文作成
 * 配送日時指定と注文確定
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { orderApi, settingsApi, farmerApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { DeliveryTimeSlot, type OrderCreateRequest, DeliverySchedule } from '@/types'
import { Trash2, ShoppingCart, Calendar, MapPin, ChevronLeft } from 'lucide-react'
import { format, addDays, parseISO, isAfter } from 'date-fns'
import { ja } from 'date-fns/locale'
import DeliveryCalendar from '@/components/DeliveryCalendar'
import AvailabilityModal from '@/components/AvailabilityModal'

export default function Cart() {
  const navigate = useNavigate()
  const { cart, getCartTotal, updateCartQuantity, removeFromCart, clearCart, restaurant } = useStore()

  // Delivery details
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<DeliveryTimeSlot | ''>('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [availableTimeSlots, setAvailableTimeSlots] = useState<{ value: DeliveryTimeSlot, label: string }[]>([])

  // Availability Modal State
  const [isAvailModalOpen, setIsAvailModalOpen] = useState(false);
  const [unavailableItems, setUnavailableItems] = useState<any[]>([]);
  const [nextDateSuggestion, setNextDateSuggestion] = useState<{ date: string, label: string } | undefined>();

  // Delivery Settings
  const { data: settings } = useQuery({
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

  // Bulk Availability for suggestions
  const uniqueFarmerIds = Array.from(new Set(
    cart
      .map(item => item.product.farmer_id)
      .filter(id => id !== undefined && id !== null && id !== 0)
  )) as number[];

  const { data: bulkAvailability } = useQuery({
    queryKey: ['farmer-availability-bulk', format(new Date(), 'yyyy-MM'), uniqueFarmerIds],
    queryFn: async () => {
      if (uniqueFarmerIds.length === 0) return null;
      const start = format(new Date(), 'yyyy-MM-dd');
      const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      const res = await farmerApi.checkAvailabilityBulk({
        farmer_ids: uniqueFarmerIds,
        start_date: start,
        end_date: end
      });
      return res.data;
    },
    enabled: uniqueFarmerIds.length > 0
  });

  // Min date (3 days from now)
  const minDate = format(addDays(new Date(), 3), 'yyyy-MM-dd')

  const defaultTimeSlots = [
    { value: DeliveryTimeSlot.SLOT_12_14, label: '12:00 〜 14:00' },
    { value: DeliveryTimeSlot.SLOT_14_16, label: '14:00 〜 16:00' },
    { value: DeliveryTimeSlot.SLOT_16_18, label: '16:00 〜 18:00' },
  ];

  // Initialize time slots based on settings initially, but will be overridden by schedule selection
  useState(() => {
    if (settings) {
      const slots = settings.time_slots?.filter(s => s.enabled).map(s => ({
        value: s.id as DeliveryTimeSlot,
        label: s.label
      })) || defaultTimeSlots;
      setAvailableTimeSlots(slots);
    } else {
      setAvailableTimeSlots(defaultTimeSlots);
    }
  });

  const handleDateSelect = (date: string, schedule?: DeliverySchedule) => {
    setDeliveryDate(date);
    setDeliveryTimeSlot(''); // Reset time slot on date change

    // Determine available time slots for this date
    if (schedule && schedule.time_slot) {
      const slotsStr = schedule.time_slot.split(',');
      const validSlots: { value: DeliveryTimeSlot, label: string }[] = [];

      slotsStr.forEach(slotStr => {
        let mappedSlot: DeliveryTimeSlot | null = null;
        if (slotStr.includes('12') && slotStr.includes('14')) mappedSlot = DeliveryTimeSlot.SLOT_12_14;
        else if (slotStr.includes('14') && slotStr.includes('16')) mappedSlot = DeliveryTimeSlot.SLOT_14_16;
        else if (slotStr.includes('16') && slotStr.includes('18')) mappedSlot = DeliveryTimeSlot.SLOT_16_18;

        if (mappedSlot) {
          // Avoid duplicates
          if (!validSlots.some(s => s.value === mappedSlot)) {
            validSlots.push({ value: mappedSlot, label: slotStr.trim() });
          }
        }
      });

      if (validSlots.length > 0) {
        setAvailableTimeSlots(validSlots);
      } else {
        setAvailableTimeSlots(defaultTimeSlots);
      }
    } else {
      // No specific schedule info (shouldn't happen if calendar logic enforces schedule existence for selection)
      const slots = settings?.time_slots?.filter(s => s.enabled).map(s => ({
        value: s.id as DeliveryTimeSlot,
        label: s.label
      })) || defaultTimeSlots;
      setAvailableTimeSlots(slots);
    }
  }

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

  const handleSubmitOrder = async () => {
    if (!restaurant) {
      alert('飲食店情報が見つかりません')
      return
    }

    if (!deliveryDate || !deliveryTimeSlot) {
      alert('配送日と時間帯を選択してください')
      return
    }

    // --- Validation: Check Farmer Availability ---
    if (uniqueFarmerIds.length > 0) {
      const badItems: any[] = [];

      for (const farmerId of uniqueFarmerIds) {
        try {
          const res = await farmerApi.checkAvailability(farmerId, deliveryDate);
          if (!res.data.is_available) {
            const product = cart.find(item => item.product.farmer_id === farmerId)?.product;
            badItems.push({
              productName: product?.name || "商品",
              farmerName: product?.farmer?.name || "農家",
              reason: res.data.reason || "出荷不可",
              productId: product?.id,
              farmerId: farmerId
            });
          }
        } catch (e: any) {
          console.error("Availability check failed", e);
          alert(`出荷状況を確認できませんでした。再度お試しください。`);
          return;
        }
      }

      if (badItems.length > 0) {
        setUnavailableItems(badItems);

        // Find next candidate date where all are available
        if (bulkAvailability) {
          const today = new Date();
          const dates = Object.keys(bulkAvailability).sort();
          const nextComplete = dates.find(d => {
            const dObj = new Date(d);
            return isAfter(dObj, today) && bulkAvailability[d].all_available;
          });

          if (nextComplete) {
            setNextDateSuggestion({
              date: nextComplete,
              label: format(parseISO(nextComplete), 'M月d日(E)', { locale: ja })
            });
          }
        }

        setIsAvailModalOpen(true);
        return; // Block submission
      }
    }
    // ---------------------------------------------

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

  const handleConsolidate = (date: string) => {
    setDeliveryDate(date);
    setIsAvailModalOpen(false);
    // User can now review the new date in the UI
  };

  const handleRemoveUnavailable = () => {
    const idsToRemove = unavailableItems.map(item => item.productId);
    idsToRemove.forEach(id => removeFromCart(id));
    setIsAvailModalOpen(false);
    // UI will update and user can click submit again
  };

  const subtotal = cart.reduce((sum, item) => {
    // Ensure price is treated as a number, defaulting to 0 if invalid
    const price = parseFloat(String(item.product.price));
    const qty = Number(item.quantity);
    return sum + (isNaN(price) ? 0 : price) * qty;
  }, 0)

  const totalWithTax = getCartTotal()
  const taxAmount = totalWithTax - subtotal;

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
                  ¥{parseFloat(String(item.product.price)).toLocaleString()} / {item.product.unit} <span className="text-xs text-gray-400">(税抜)</span>
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
              onSelect={handleDateSelect}
              minDate={minDate}
              cart={cart}
            />
            <p className="text-xs text-gray-500 mt-2">※3日後以降の日付を選択可能（○：揃う、△：一部不可、×：不可）</p>
          </div>

          {/* Delivery Time Slot */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              配送時間帯 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {availableTimeSlots.map((slot) => (
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
              {availableTimeSlots.length === 0 && (
                <p className="text-sm text-gray-500">
                  日付を選択すると、利用可能な時間帯が表示されます。
                </p>
              )}
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
              <span>¥{taxAmount.toLocaleString()}</span>
            </div>
            {restaurant?.shipping_fee ? (
              <div className="flex justify-between text-sm text-gray-600">
                <span>配送料</span>
                <span>¥{restaurant.shipping_fee.toLocaleString()}</span>
              </div>
            ) : null}
            <div className="border-t pt-3 flex justify-between items-baseline">
              <span className="font-bold text-gray-900">合計 (税込)</span>
              <span className="text-2xl font-bold text-blue-600">
                ¥{(totalWithTax + (restaurant?.shipping_fee || 0)).toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={!deliveryDate || !deliveryTimeSlot || createOrderMutation.isPending || (totalWithTax + (restaurant?.shipping_fee || 0)) === 0}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {createOrderMutation.isPending ? '注文を送信中...' : '注文を確定する'}
          </button>
        </div>
      </div>
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
