import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi, productApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import { FileText, Package, Edit3, XCircle, Plus, Trash2 } from 'lucide-react'
import Loading from '@/components/Loading'
import { Order, DeliveryTimeSlot } from '@/types'
import { toast } from 'sonner'
import { format, addDays, isAfter, subDays, startOfDay } from 'date-fns'

const STATUS_MAP: Record<string, string> = {
  pending: '確認中',
  confirmed: '注文確定',
  shipped: '配送中',
  delivered: '配達完了',
  cancelled: 'キャンセル',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export default function MyPage() {
  const { restaurant } = useStore()

  const queryClient = useQueryClient()
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<number>(0)

  // Rules
  const MIN_DELIVERY_DAYS = 3
  const CANCEL_DEADLINE_DAYS = 3

  const { data, isLoading } = useQuery({
    queryKey: ['orders', restaurant?.id],
    queryFn: () => orderApi.list({ restaurant_id: restaurant?.id, limit: 50 }),
    enabled: !!restaurant,
  })

  // Fetch products for the add item dropdown
  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => productApi.list({ limit: 100, is_active: 1 }),
  })

  const availableProducts = useMemo(() => {
    return productsData?.data.items || []
  }, [productsData])

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; updates: any }) => {
      // Create a clean update object matching OrderUpdateRequest interface
      const updateData: any = {
        delivery_date: data.updates.delivery_date,
        delivery_time_slot: data.updates.delivery_time_slot,
        notes: data.updates.notes,
        items: data.updates.items,
      };

      return orderApi.update(data.id, updateData);
    },
    onSuccess: () => {
      toast.success('注文内容を変更しました')
      setEditingOrder(null)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || '変更に失敗しました')
    }
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => orderApi.cancel(id),
    onSuccess: () => {
      toast.success('注文をキャンセルしました')
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'キャンセルに失敗しました')
    }
  })

  const canEditOrCancel = (order: Order) => {
    if (!order.delivery_date) return false
    const deliveryDate = new Date(order.delivery_date)
    const today = startOfDay(new Date())
    const deadline = subDays(deliveryDate, CANCEL_DEADLINE_DAYS)
    return isAfter(deadline, today) || deadline.getTime() === today.getTime()
  }

  const handleEdit = (order: Order) => {
    // Clone order to avoid mutating cache and allow local edits
    setEditingOrder(JSON.parse(JSON.stringify(order)))
    setSelectedProductId(0)
  }

  const handleAddItem = () => {
    if (!editingOrder || !selectedProductId) return

    const product = availableProducts.find(p => p.id === Number(selectedProductId))
    if (!product) return

    // Check if already exists
    const existingItemIndex = editingOrder.items.findIndex(item => item.product_id === product.id)

    const newItems = [...editingOrder.items]
    if (existingItemIndex >= 0) {
      // Increment quantity
      newItems[existingItemIndex].quantity = Number(newItems[existingItemIndex].quantity) + 1
    } else {
      // Add new item (mocking OrderItem structure for UI)
      const newItem: any = {
        id: -Date.now(), // Temporary ID
        product_id: product.id,
        quantity: 1,
        product_name: product.name,
        product_unit: product.unit,
        unit_price: product.price,
        subtotal: product.price,
        // Add other required fields if needed for display
      }
      newItems.push(newItem)
    }

    setEditingOrder({ ...editingOrder, items: newItems })
    setSelectedProductId(0)
  }

  const handleRemoveItem = (index: number) => {
    if (!editingOrder) return
    const newItems = [...editingOrder.items]
    newItems.splice(index, 1)
    setEditingOrder({ ...editingOrder, items: newItems })
  }

  const handleQuantityChange = (index: number, qty: number) => {
    if (!editingOrder) return
    const newItems = [...editingOrder.items]
    newItems[index].quantity = qty
    setEditingOrder({ ...editingOrder, items: newItems })
  }

  const handleCancel = (id: number) => {
    if (window.confirm('本当にこの注文をキャンセルしますか？')) {
      cancelMutation.mutate(id)
    }
  }

  const handleUpdateOrder = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrder) return

    // Collect updated items
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)

    const delivery_date = formData.get('delivery_date') as string
    const delivery_time_slot = formData.get('delivery_time_slot') as DeliveryTimeSlot
    const notes = formData.get('notes') as string

    // Parse items from state instead of form inputs to handle added items correctly
    const items = editingOrder.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    })).filter(item => Number(item.quantity) > 0)

    if (items.length === 0) {
      toast.error('商品が1つもありません。キャンセルしてください。')
      return
    }

    updateMutation.mutate({
      id: editingOrder.id,
      updates: {
        delivery_date: delivery_date ? new Date(delivery_date).toISOString() : undefined,
        delivery_time_slot,
        notes,
        items
      }
    })
  }

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      const blob = await orderApi.downloadInvoice(orderId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice_${orderId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Invoice download failed:', error)
      alert('請求書のダウンロードに失敗しました')
    }
  }

  if (isLoading) return <Loading message="注文履歴を読み込み中..." />

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <Package className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">マイページ</h2>
          <p className="text-sm text-gray-600">店舗情報と注文履歴を管理します</p>
        </div>
      </div>

      {/* Edit Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold">注文内容の変更</h3>
              <button onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdateOrder} className="p-6 space-y-6">
              {/* Delivery Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配送希望日</label>
                  <input
                    type="date"
                    name="delivery_date"
                    required
                    min={format(addDays(new Date(), MIN_DELIVERY_DAYS), 'yyyy-MM-dd')}
                    defaultValue={format(new Date(editingOrder.delivery_date), 'yyyy-MM-dd')}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">※本日より{MIN_DELIVERY_DAYS}日後以降を指定可能</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">配送時間帯</label>
                  <select
                    name="delivery_time_slot"
                    defaultValue={editingOrder.delivery_time_slot}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  >
                    <option value={DeliveryTimeSlot.SLOT_12_14}>12:00 - 14:00</option>
                    <option value={DeliveryTimeSlot.SLOT_14_16}>14:00 - 16:00</option>
                    <option value={DeliveryTimeSlot.SLOT_16_18}>16:00 - 18:00</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">注文メモ</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingOrder.notes || ''}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-end mb-3 border-b pb-2">
                  <h4 className="font-medium text-gray-900">注文商品</h4>
                </div>

                {/* Add Item Section */}
                <div className="flex gap-2 mb-4">
                  <select
                    className="flex-1 rounded-lg border-gray-300 text-sm"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  >
                    <option value={0}>商品を追加...</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({Number(p.price).toLocaleString()}円/{p.unit})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!selectedProductId}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  {editingOrder.items.map((item, index) => (
                    <div key={item.id || `temp-${index}`} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{item.product_name}</p>
                        <p className="text-xs text-gray-500">{Number(item.unit_price).toLocaleString()}円 / {item.product_unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, Number(e.target.value))}
                          min="1"
                          className="w-20 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 text-right"
                        />
                        <span className="text-sm text-gray-600 w-8">{item.product_unit}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {editingOrder.items.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-4">商品が選択されていません</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? '保存中...' : '変更を保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restaurant Info Card (Optional but nice) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <h3 className="text-lg font-bold mb-4">店舗情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500 text-sm block">店舗名</span>
            <span className="font-medium">{restaurant?.name}</span>
          </div>
          <div>
            <span className="text-gray-500 text-sm block">住所</span>
            <span className="font-medium">{restaurant?.address}</span>
          </div>
          <div>
            <span className="text-gray-500 text-sm block">電話番号</span>
            <span className="font-medium">{restaurant?.phone_number}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">注文履歴</h3>
        </div>

        {/* Order List */}
        <div className="divide-y divide-gray-100">
          {data?.data.items.map((order) => (
            <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                      {STATUS_MAP[order.status] || order.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      注文日: {new Date(order.created_at).toLocaleDateString('ja-JP')}
                    </span>
                    <span className="text-sm text-gray-500">
                      注文ID: #{order.id}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        ¥{Number(order.total_amount).toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">
                        (配送希望日: {new Date(order.delivery_date).toLocaleDateString('ja-JP')})
                      </span>
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mt-2">
                    <p className="font-medium mb-1">注文内容 ({order.items.length}点):</p>
                    <ul className="list-disc list-inside pl-1 space-y-0.5">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <li key={idx} className="truncate">
                          {item.product_name} × {item.quantity}{item.product_unit}
                        </li>
                      ))}
                      {order.items.length > 3 && (
                        <li className="list-none text-gray-400 pl-4 text-xs">
                          他 {order.items.length - 3} 点...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 min-w-[140px]">
                  {canEditOrCancel(order) && order.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleEdit(order)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-all w-full text-sm font-medium shadow-sm"
                      >
                        <Edit3 size={16} />
                        <span>変更する</span>
                      </button>
                      <button
                        onClick={() => handleCancel(order.id)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all w-full text-sm font-medium shadow-sm"
                      >
                        <XCircle size={16} />
                        <span>キャンセル</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleDownloadInvoice(order.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-blue-600 hover:border-blue-300 transition-all w-full text-sm font-medium shadow-sm"
                  >
                    <FileText size={16} />
                    <span>請求書発行</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(!data?.data.items || data.data.items.length === 0) && (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <Package className="w-12 h-12 text-gray-300 mb-3" />
              <p>注文履歴がありません</p>
              <p className="text-sm mt-1 text-gray-400">商品一覧から注文を行ってください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
