import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Truck, Loader2, Save, AlertTriangle, RefreshCw } from 'lucide-react'
import { adminProcurementApi } from '@/services/api'
import type { ProcurementBatch, ProcurementItem, CalendarDateEntry } from '@/types'
import { ProcurementStatus } from '@/types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns'
import { ja } from 'date-fns/locale'

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  [ProcurementStatus.COLLECTING]: { label: '受付中', bg: 'bg-blue-100', text: 'text-blue-700' },
  [ProcurementStatus.AGGREGATED]: { label: '集計済み', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  [ProcurementStatus.ORDERED]: { label: '発注済み', bg: 'bg-green-100', text: 'text-green-700' },
  [ProcurementStatus.FULFILLED]: { label: '納品完了', bg: 'bg-gray-100', text: 'text-gray-600' },
}

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export default function UnifiedProcurementManagement() {
  const queryClient = useQueryClient()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showOrderConfirm, setShowOrderConfirm] = useState(false)
  const [editingItems, setEditingItems] = useState<Record<number, string>>({})

  const monthStr = format(currentMonth, 'yyyy-MM')

  // カレンダーデータ取得
  const { data: calendarData } = useQuery({
    queryKey: ['admin', 'procurement-calendar', monthStr],
    queryFn: async () => {
      const res = await adminProcurementApi.getCalendar(monthStr)
      return res.data as CalendarDateEntry[]
    },
  })

  // 選択日のバッチ詳細（集計後に取得）
  const { data: batchDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['admin', 'procurement-batch-by-date', selectedDate],
    queryFn: async () => {
      const res = await adminProcurementApi.list({ status: undefined })
      const batches: ProcurementBatch[] = res.data?.items || []
      const match = batches.find(b => b.delivery_date === selectedDate)
      if (!match) return null
      const detail = await adminProcurementApi.getById(match.id)
      return detail.data as ProcurementBatch
    },
    enabled: !!selectedDate,
  })

  // カレンダー日付マップ
  const dateMap = useMemo(() => {
    const map: Record<string, CalendarDateEntry> = {}
    calendarData?.forEach((d) => { map[d.date] = d })
    return map
  }, [calendarData])

  // カレンダーグリッド
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const startDate = new Date(start)
    startDate.setDate(start.getDate() - startDate.getDay())
    const endDate = new Date(end)
    endDate.setDate(end.getDate() + (6 - end.getDay()))
    return eachDayOfInterval({ start: startDate, end: endDate })
  }, [currentMonth])

  // 統合集計 mutation
  const aggregateMutation = useMutation({
    mutationFn: (deliveryDate: string) => adminProcurementApi.aggregateUnified({ delivery_date: deliveryDate }),
    onSuccess: () => {
      toast.success('集計が完了しました')
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-batch-by-date', selectedDate] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '集計に失敗しました'),
  })

  // 数量更新 mutation
  const updateItemMutation = useMutation({
    mutationFn: ({ batchId, itemId, data }: { batchId: number; itemId: number; data: { ordered_farmer_qty?: number } }) =>
      adminProcurementApi.updateItem(batchId, itemId, data),
    onSuccess: () => {
      toast.success('数量を更新しました')
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-batch-by-date', selectedDate] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '更新に失敗しました'),
  })

  // 農家発注 mutation
  const orderMutation = useMutation({
    mutationFn: (batchId: number) => adminProcurementApi.orderFromFarmers(batchId),
    onSuccess: (res) => {
      toast.success(res.data?.message || '農家への発注が完了しました')
      setShowOrderConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'procurement-batch-by-date', selectedDate] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || '発注に失敗しました'),
  })

  const handleSaveItem = (item: ProcurementItem) => {
    const newQty = editingItems[item.id]
    if (newQty === undefined) return
    updateItemMutation.mutate({
      batchId: item.batch_id,
      itemId: item.id,
      data: { ordered_farmer_qty: parseInt(newQty) },
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

  // 農家ごとにアイテムをグループ化
  const groupedByFarmer = useMemo(() => {
    if (!batchDetail?.items) return []
    const map: Record<string, { farmer_name: string; farmer_id: number; items: ProcurementItem[] }> = {}
    for (const item of batchDetail.items) {
      const fid = item.farmer_id || 0
      const fname = item.farmer_name || '不明'
      if (!map[fid]) {
        map[fid] = { farmer_name: fname, farmer_id: fid, items: [] }
      }
      map[fid].items.push(item)
    }
    return Object.values(map).sort((a, b) => a.farmer_name.localeCompare(b.farmer_name))
  }, [batchDetail?.items])

  const weekDays = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="space-y-6">
      {/* カレンダーセクション */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">統合仕入れカレンダー</h2>
          <div className="flex items-center gap-4">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-bold">{format(currentMonth, 'yyyy年 M月', { locale: ja })}</span>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-t border-l">
          {weekDays.map((day, idx) => (
            <div
              key={idx}
              className={`p-2 text-center text-sm font-bold border-r border-b bg-gray-50 ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}`}
            >
              {day}
            </div>
          ))}

          {calendarDays.map((date, idx) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const info = dateMap[dateStr]
            const isCurrentMonth = isSameMonth(date, currentMonth)
            const isSelected = selectedDate === dateStr
            const isToday = isSameDay(date, new Date())
            const hasOrders = Boolean(info)
            const totalOrders = info ? info.b2b_order_count + info.b2c_order_count : 0

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(dateStr)}
                className={`
                  h-24 p-1 border-r border-b cursor-pointer transition-colors relative
                  ${isCurrentMonth ? 'bg-white hover:bg-green-50' : 'bg-gray-50 text-gray-400'}
                  ${isSelected ? 'bg-green-100 ring-2 ring-inset ring-green-500' : ''}
                `}
              >
                <span className={`text-sm w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : ''}`}>
                  {format(date, 'd')}
                </span>

                {hasOrders && isCurrentMonth && (
                  <div className="absolute bottom-1 left-1 right-1 space-y-0.5">
                    <div className="flex items-center gap-1">
                      {info.b2b_order_count > 0 && (
                        <span className="inline-flex items-center px-1 py-0 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
                          B2B:{info.b2b_order_count}
                        </span>
                      )}
                      {info.b2c_order_count > 0 && (
                        <span className="inline-flex items-center px-1 py-0 rounded text-[9px] font-bold bg-purple-100 text-purple-700">
                          B2C:{info.b2c_order_count}
                        </span>
                      )}
                    </div>
                    {info.batch_status && (
                      <StatusBadge status={info.batch_status} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 日付詳細セクション */}
      {selectedDate && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-xl font-bold">
                {format(new Date(selectedDate + 'T00:00:00'), 'M月d日 (E)', { locale: ja })} の仕入れ管理
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                B2B（飲食店）+ B2C（消費者）注文を統合して農家に発注
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* 集計ボタン */}
              {(!batchDetail || batchDetail.status === ProcurementStatus.COLLECTING || batchDetail.status === ProcurementStatus.AGGREGATED) && (
                <button
                  onClick={() => aggregateMutation.mutate(selectedDate)}
                  disabled={aggregateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                >
                  {aggregateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {batchDetail ? '再集計する' : '集計する'}
                </button>
              )}
              {/* 発注ボタン */}
              {batchDetail?.status === ProcurementStatus.AGGREGATED && (
                <button
                  onClick={() => setShowOrderConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  <Truck className="w-4 h-4" />
                  農家へ発注する
                </button>
              )}
            </div>
          </div>

          {isDetailLoading ? (
            <div className="text-center py-12 text-gray-500">読み込み中...</div>
          ) : batchDetail ? (
            <>
              {/* バッチサマリー */}
              <div className="p-6 border-b bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-xs text-gray-500">ステータス</div>
                    <div className="mt-1"><StatusBadge status={batchDetail.status} /></div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-xs text-gray-500">注文数合計</div>
                    <div className="text-xl font-bold">{batchDetail.total_orders} 件</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-xs text-gray-500">集計日時</div>
                    <div className="text-sm font-medium">{formatDateTime(batchDetail.aggregated_at)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-xs text-gray-500">発注日時</div>
                    <div className="text-sm font-medium">{formatDateTime(batchDetail.ordered_at)}</div>
                  </div>
                </div>
              </div>

              {/* アイテムテーブル（農家ごとにグループ化） */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">農家</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">商品名</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">B2B数量</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">B2C小売数</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">B2C換算</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">発注数量</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600">単価</th>
                      {batchDetail.status === ProcurementStatus.AGGREGATED && (
                        <th className="px-4 py-3 text-center font-medium text-gray-600 w-16"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupedByFarmer.map((group) =>
                      group.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          {idx === 0 && (
                            <td className="px-4 py-3 font-bold text-gray-900 border-r align-top bg-white" rowSpan={group.items.length}>
                              {group.farmer_name}
                            </td>
                          )}
                          <td className="px-4 py-3 text-gray-900">
                            {item.source_product_name || '-'}
                            {item.source_product_unit && (
                              <span className="text-xs text-gray-400 ml-1">({item.source_product_unit})</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.b2b_direct_qty > 0 ? (
                              <span className="font-medium text-blue-700">{item.b2b_direct_qty}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.total_retail_qty > 0 ? (
                              <span className="font-medium text-purple-700">{item.total_retail_qty}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {Number(item.calculated_farmer_qty) > 0 ? item.calculated_farmer_qty : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {batchDetail.status === ProcurementStatus.AGGREGATED ? (
                              <input
                                type="number"
                                min="0"
                                value={editingItems[item.id] !== undefined ? editingItems[item.id] : item.ordered_farmer_qty}
                                onChange={e => setEditingItems(prev => ({ ...prev, [item.id]: e.target.value }))}
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                              />
                            ) : (
                              <span className="font-bold text-gray-900">{item.ordered_farmer_qty}</span>
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
                      ))
                    )}
                  </tbody>
                </table>
                {groupedByFarmer.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-lg font-medium">この日の注文データはありません</p>
                    <p className="text-sm mt-2">注文がある日付を選択して「集計する」を実行してください</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">この日のバッチはまだ作成されていません</p>
              <p className="text-sm mt-2">「集計する」ボタンで注文を集約できます</p>
            </div>
          )}
        </div>
      )}

      {/* 日付未選択時 */}
      {!selectedDate && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          <p className="text-lg font-medium">カレンダーから日付を選択してください</p>
          <p className="text-sm mt-2">B2B（飲食店）+ B2C（消費者）の注文を統合して農家に発注できます</p>
        </div>
      )}

      {/* 発注確認ダイアログ */}
      {showOrderConfirm && batchDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-yellow-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold">農家への発注確認</h3>
            </div>
            <p className="text-sm text-gray-600">
              この操作を実行すると、集計された数量をもとに各農家へLINE通知が送信されます。
            </p>
            <div className="text-sm font-medium text-gray-800 space-y-1">
              <p>配送日: {formatDate(batchDetail.delivery_date)}</p>
              <p>農家数: {groupedByFarmer.length} 件</p>
              <p>品目数: {batchDetail.items?.length || 0} 件</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowOrderConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={() => orderMutation.mutate(batchDetail.id)}
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
