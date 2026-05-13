import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ClipboardList, RefreshCw, Truck, ChevronLeft, Loader2, Save, AlertTriangle } from 'lucide-react'
import { adminProcurementApi, adminDeliverySlotApi } from '@/services/api'
import type { ProcurementBatch, ProcurementItem, DeliverySlot } from '@/types'
import { ProcurementStatus } from '@/types'

const statusConfig: Record<ProcurementStatus, { label: string; bg: string; text: string }> = {
  [ProcurementStatus.COLLECTING]: { label: '注文受付中', bg: 'bg-blue-100', text: 'text-blue-700' },
  [ProcurementStatus.AGGREGATED]: { label: '集計済み', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  [ProcurementStatus.ORDERED]: { label: '発注済み', bg: 'bg-green-100', text: 'text-green-700' },
  [ProcurementStatus.FULFILLED]: { label: '納品完了', bg: 'bg-gray-100', text: 'text-gray-600' },
}

function StatusBadge({ status }: { status: ProcurementStatus }) {
  const config = statusConfig[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export default function ConsumerProcurementManagement() {
  const queryClient = useQueryClient()
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
  const [aggregateSlotId, setAggregateSlotId] = useState<string>('')
  const [showOrderConfirm, setShowOrderConfirm] = useState(false)
  const [editingItems, setEditingItems] = useState<Record<number, string>>({})

  // Fetch procurement batches
  const { data: batchesData, isLoading } = useQuery({
    queryKey: ['admin', 'procurement-batches'],
    queryFn: async () => {
      const res = await adminProcurementApi.list()
      return res.data
    },
  })

  // Fetch single batch detail
  const { data: batchDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['admin', 'procurement-batch', selectedBatchId],
    queryFn: async () => {
      const res = await adminProcurementApi.getById(selectedBatchId!)
      return res.data as ProcurementBatch
    },
    enabled: !!selectedBatchId,
  })

  // Fetch delivery slots for aggregation
  const { data: slotsData } = useQuery({
    queryKey: ['admin', 'delivery-slots-for-procurement'],
    queryFn: async () => {
      const res = await adminDeliverySlotApi.list({ limit: 200 })
      return res.data
    },
  })

  const deliverySlots: DeliverySlot[] = slotsData?.items || []
  const today = new Date().toISOString().split('T')[0]
  const futureSlots = deliverySlots
    .filter(s => s.date >= today && s.is_active)
    .sort((a, b) => a.date.localeCompare(b.date))

  const batches: ProcurementBatch[] = batchesData?.items || []

  // Aggregate mutation
  const aggregateMutation = useMutation({
    mutationFn: (data: { delivery_slot_id: number }) => adminProcurementApi.aggregate(data),
    onSuccess: () => {
      toast.success('集計が完了しました')
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-batches'] })
      setAggregateSlotId('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '集計に失敗しました'),
  })

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: ({ batchId, itemId, data }: { batchId: number; itemId: number; data: { ordered_farmer_qty?: number; notes?: string } }) =>
      adminProcurementApi.updateItem(batchId, itemId, data),
    onSuccess: () => {
      toast.success('数量を更新しました')
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-batch', selectedBatchId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '更新に失敗しました'),
  })

  // Order from farmers mutation
  const orderMutation = useMutation({
    mutationFn: (batchId: number) => adminProcurementApi.orderFromFarmers(batchId),
    onSuccess: (res) => {
      const message = res.data?.message || '農家への発注が完了しました'
      toast.success(message)
      setShowOrderConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-batches'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-batch', selectedBatchId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '発注に失敗しました'),
  })

  const handleAggregate = () => {
    if (!aggregateSlotId) {
      toast.error('受取枠を選択してください')
      return
    }
    aggregateMutation.mutate({ delivery_slot_id: parseInt(aggregateSlotId) })
  }

  const handleSaveItem = (item: ProcurementItem) => {
    const newQty = editingItems[item.id]
    if (newQty === undefined) return
    updateItemMutation.mutate({
      batchId: item.batch_id,
      itemId: item.id,
      data: { ordered_farmer_qty: parseFloat(newQty) },
    })
    setEditingItems(prev => {
      const next = { ...prev }
      delete next[item.id]
      return next
    })
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
    const weekdays = ['日', '月', '火', '水', '木', '金', '土']
    return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
  }

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // Batch detail view
  if (selectedBatchId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedBatchId(null); setEditingItems({}) }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            仕入れバッチ詳細
          </h2>
        </div>

        {isDetailLoading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : batchDetail ? (
          <>
            {/* Batch Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">配送日</p>
                  <p className="text-lg font-bold">{formatDate(batchDetail.delivery_date)}</p>
                  {batchDetail.delivery_time && (
                    <p className="text-sm text-gray-600">{batchDetail.delivery_time}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">ステータス</p>
                  <div className="mt-1">
                    <StatusBadge status={batchDetail.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">消費者注文数</p>
                  <p className="text-lg font-bold">{batchDetail.total_orders} 件</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">集計日時</p>
                  <p className="text-sm font-medium">{formatDateTime(batchDetail.aggregated_at)}</p>
                  {batchDetail.ordered_at && (
                    <>
                      <p className="text-sm text-gray-500 mt-1">発注日時</p>
                      <p className="text-sm font-medium">{formatDateTime(batchDetail.ordered_at)}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Order from farmers button */}
            {batchDetail.status === ProcurementStatus.AGGREGATED && (
              <div className="flex justify-end">
                <button
                  onClick={() => setShowOrderConfirm(true)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  <Truck className="w-4 h-4" />
                  農家へ発注する
                </button>
              </div>
            )}

            {/* Items Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b">
                <h3 className="font-bold text-gray-900">仕入れ品目一覧</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">農家商品</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">農家</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">小売商品</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">小売合計数</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">換算数量</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">発注数量</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">単価</th>
                      {batchDetail.status === ProcurementStatus.AGGREGATED && (
                        <th className="px-4 py-3 text-center font-medium text-gray-600">操作</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(batchDetail.items || []).map((item: ProcurementItem) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {item.source_product_name || '-'}
                          {item.source_product_unit && (
                            <span className="text-xs text-gray-400 ml-1">({item.source_product_unit})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.farmer_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{item.retail_product_name || '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{item.total_retail_qty}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.calculated_farmer_qty}</td>
                        <td className="px-4 py-3 text-right">
                          {batchDetail.status === ProcurementStatus.AGGREGATED ? (
                            <input
                              type="number"
                              step="0.1"
                              value={editingItems[item.id] !== undefined ? editingItems[item.id] : item.ordered_farmer_qty}
                              onChange={e => setEditingItems(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                            />
                          ) : (
                            <span className="font-bold">{item.ordered_farmer_qty}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {item.unit_cost ? `${Number(item.unit_cost).toLocaleString()}円` : '-'}
                        </td>
                        {batchDetail.status === ProcurementStatus.AGGREGATED && (
                          <td className="px-4 py-3 text-center">
                            {editingItems[item.id] !== undefined && (
                              <button
                                onClick={() => handleSaveItem(item)}
                                disabled={updateItemMutation.isPending}
                                className="p-1.5 rounded hover:bg-green-50 text-green-600"
                                title="保存"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!batchDetail.items || batchDetail.items.length === 0) && (
                  <div className="text-center py-8 text-gray-500">品目データがありません</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">バッチが見つかりません</div>
        )}

        {/* Order Confirmation Dialog */}
        {showOrderConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-3 text-yellow-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold">農家への発注確認</h3>
              </div>
              <p className="text-sm text-gray-600">
                この操作を実行すると、集計された数量をもとに各農家へ発注通知が送信されます。
                発注後は数量の変更ができなくなります。
              </p>
              <p className="text-sm font-medium text-gray-800">
                配送日: {formatDate(batchDetail?.delivery_date)}<br />
                品目数: {batchDetail?.items?.length || 0} 件
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowOrderConfirm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => selectedBatchId && orderMutation.mutate(selectedBatchId)}
                  disabled={orderMutation.isPending}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-60 flex items-center gap-2"
                >
                  {orderMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  発注を実行
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Batch list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          仕入れ集計 (消費者向け)
        </h2>
      </div>

      {/* Aggregate Action */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-bold text-gray-900">新しい集計を実行</h3>
        <p className="text-sm text-gray-500">受取枠を選択して、その枠に紐づく消費者注文を集計します。</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={aggregateSlotId}
            onChange={e => setAggregateSlotId(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">受取枠を選択...</option>
            {futureSlots.map(slot => (
              <option key={slot.id} value={slot.id}>
                {formatDate(slot.date)} {slot.time_text} ({slot.slot_type})
              </option>
            ))}
          </select>
          <button
            onClick={handleAggregate}
            disabled={aggregateMutation.isPending || !aggregateSlotId}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            {aggregateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            集計する
          </button>
        </div>
      </div>

      {/* Batches List */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">読み込み中...</div>
      ) : batches.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
          仕入れバッチがありません
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">配送日</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">時間帯</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">ステータス</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">注文数</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">品目数</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">集計日時</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {batches.map(batch => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">#{batch.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{formatDate(batch.delivery_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{batch.delivery_time || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={batch.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{batch.total_orders}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{batch.items?.length || 0}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(batch.aggregated_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedBatchId(batch.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium hover:underline"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
