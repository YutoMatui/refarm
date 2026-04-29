import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { orderApi, farmerApi } from '@/services/api'
import { Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import Loading from '@/components/Loading'

export default function ProcurementManagement() {
    const [filterText, setFilterText] = useState('')
    const [selectedFarmerId, setSelectedFarmerId] = useState<number | 'all'>('all')
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<string | null>(null)

    const monthStr = format(currentMonth, 'yyyy-MM')

    // 月間の仕入れ日一覧を取得
    const { data: monthlyDates } = useQuery({
        queryKey: ['procurement-monthly-dates', monthStr],
        queryFn: () => orderApi.getMonthlyDates(monthStr),
    })

    // 選択日の日別集計を取得
    const { data: aggregationData, isLoading: isAggLoading } = useQuery({
        queryKey: ['procurement-aggregation', selectedDate],
        queryFn: () => orderApi.getDailyAggregation(selectedDate!),
        enabled: !!selectedDate,
    })

    const { data: farmersData } = useQuery({
        queryKey: ['admin-farmers-list'],
        queryFn: async () => {
            const response = await farmerApi.list({ limit: 1000 })
            return response.data
        },
    })

    // カレンダー日付マップ
    const dateMap = useMemo(() => {
        const map: Record<string, { farmer_count: number; restaurant_count: number }> = {}
        monthlyDates?.forEach((d) => {
            map[d.date] = { farmer_count: d.farmer_count, restaurant_count: d.restaurant_count }
        })
        return map
    }, [monthlyDates])

    // カレンダーグリッド生成
    const calendarDays = useMemo(() => {
        const start = startOfMonth(currentMonth)
        const end = endOfMonth(currentMonth)
        const startDate = new Date(start)
        startDate.setDate(start.getDate() - startDate.getDay())
        const endDate = new Date(end)
        endDate.setDate(end.getDate() + (6 - end.getDay()))
        return eachDayOfInterval({ start: startDate, end: endDate })
    }, [currentMonth])

    const handleDateClick = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        setSelectedDate(dateStr)
    }

    // CSV出力
    const handleDownloadCSV = () => {
        if (!aggregationData || !selectedDate) return
        const headers = ['配送日', '生産者ID', '生産者名', '商品名', '合計数量', '単位']
        const rows: string[] = []
        aggregationData.forEach((farmer) => {
            farmer.products.forEach((product) => {
                const escape = (s: string | undefined | null) => `"${(s || '').replace(/"/g, '""')}"`
                rows.push(
                    [selectedDate, farmer.farmer_id, escape(farmer.farmer_name), escape(product.product_name), product.quantity, escape(product.unit)].join(',')
                )
            })
        })
        const csvContent = [headers.join(','), ...rows].join('\n')
        const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.setAttribute('href', URL.createObjectURL(blob))
        link.setAttribute('download', `procurement_${selectedDate}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // フィルタリング
    const filteredAggregation = useMemo(() => {
        if (!aggregationData) return []
        return aggregationData
            .filter((farmer) => {
                const matchesFarmer = selectedFarmerId === 'all' || farmer.farmer_id === selectedFarmerId
                if (!matchesFarmer) return false
                if (!filterText) return true
                return farmer.products.some((p) => p.product_name.includes(filterText))
            })
            .map((farmer) => {
                if (filterText) {
                    return { ...farmer, products: farmer.products.filter((p) => p.product_name.includes(filterText)) }
                }
                return farmer
            })
            .filter((farmer) => farmer.products.length > 0)
    }, [aggregationData, filterText, selectedFarmerId])

    const totalStats = useMemo(() => {
        if (!filteredAggregation) return { farmerCount: 0, productTypeCount: 0, totalItems: 0 }
        const farmerCount = filteredAggregation.length
        let productTypeCount = 0
        let totalItems = 0
        filteredAggregation.forEach((farmer) => {
            productTypeCount += farmer.products.length
            farmer.products.forEach((product) => {
                totalItems += Number(product.quantity) || 0
            })
        })
        return { farmerCount, productTypeCount, totalItems }
    }, [filteredAggregation])

    const weekDays = ['日', '月', '火', '水', '木', '金', '土']

    return (
        <div className="space-y-6">
            {/* カレンダーセクション */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">仕入れカレンダー</h2>
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

                        return (
                            <div
                                key={idx}
                                onClick={() => handleDateClick(date)}
                                className={`
                                    h-20 p-1 border-r border-b cursor-pointer transition-colors relative
                                    ${isCurrentMonth ? 'bg-white hover:bg-green-50' : 'bg-gray-50 text-gray-400'}
                                    ${isSelected ? 'bg-green-100 ring-2 ring-inset ring-green-500' : ''}
                                `}
                            >
                                <span
                                    className={`
                                    text-sm w-6 h-6 flex items-center justify-center rounded-full
                                    ${isToday ? 'bg-blue-600 text-white' : ''}
                                `}
                                >
                                    {format(date, 'd')}
                                </span>

                                {hasOrders && isCurrentMonth && (
                                    <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">
                                            農{info.farmer_count}
                                        </span>
                                        {info.restaurant_count > 0 && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                                                店{info.restaurant_count}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 日別詳細セクション */}
            {selectedDate && (
                <div className="bg-white rounded-lg shadow">
                    <div className="p-6 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold">
                                {format(new Date(selectedDate + 'T00:00:00'), 'M月d日 (E)', { locale: ja })} の仕入れ詳細
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">農家ごとの仕入れ内容と配送先飲食店</p>
                        </div>
                        <button
                            onClick={handleDownloadCSV}
                            disabled={!aggregationData || aggregationData.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                        >
                            <Download size={18} />
                            CSV出力
                        </button>
                    </div>

                    {/* Stats Cards */}
                    <div className="p-6 border-b bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="text-sm text-gray-600">生産者数</div>
                                <div className="text-2xl font-bold text-gray-900">{totalStats.farmerCount} 件</div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="text-sm text-gray-600">商品種類数</div>
                                <div className="text-2xl font-bold text-blue-600">{totalStats.productTypeCount} 種類</div>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border">
                                <div className="text-sm text-gray-600">合計数量</div>
                                <div className="text-2xl font-bold text-green-600">{totalStats.totalItems} 点</div>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="p-4 border-b flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="商品名で絞り込み..."
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                            />
                        </div>
                        <div className="sm:w-64">
                            <div className="relative">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select
                                    className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm appearance-none bg-white cursor-pointer"
                                    value={selectedFarmerId}
                                    onChange={(e) => {
                                        const val = e.target.value
                                        setSelectedFarmerId(val === 'all' ? 'all' : Number(val))
                                    }}
                                >
                                    <option value="all">全ての生産者</option>
                                    {farmersData?.items.map((f: any) => (
                                        <option key={f.id} value={f.id}>
                                            {f.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    {isAggLoading ? (
                        <Loading message="仕入れデータを読み込み中..." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r w-[25%]">生産者</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r w-[45%]">商品名</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase border-r w-[15%]">数量</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase w-[15%]">単位</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredAggregation.map((farmer) =>
                                        farmer.products.map((product, idx) => (
                                            <tr key={`${farmer.farmer_id}-${product.product_name}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                                {idx === 0 && (
                                                    <td className="px-6 py-4 text-sm font-bold text-gray-900 bg-white border-r align-top" rowSpan={farmer.products.length}>
                                                        <div className="sticky top-0">
                                                            {farmer.farmer_name}
                                                            <div className="text-xs text-gray-400 font-normal mt-1">ID: {farmer.farmer_id}</div>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-sm text-gray-900 border-r">{product.product_name}</td>
                                                <td className="px-6 py-4 text-sm text-right font-bold text-gray-900 border-r">{product.quantity}</td>
                                                <td className="px-6 py-4 text-sm text-center text-gray-600">{product.unit}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {filteredAggregation.length === 0 && (
                                <div className="text-center py-16 text-gray-500 bg-gray-50">
                                    <p className="text-lg font-medium">この日の仕入れデータはありません</p>
                                    <p className="text-sm mt-2">カレンダーからバッジのある日付を選択してください</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 日付未選択時 */}
            {!selectedDate && (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                    <p className="text-lg font-medium">カレンダーから日付を選択してください</p>
                    <p className="text-sm mt-2">選択した日の仕入れ詳細が表示されます</p>
                </div>
            )}
        </div>
    )
}
