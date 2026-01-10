import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deliveryScheduleApi } from '@/services/api'
import { DeliverySchedule } from '@/types'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay, getDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, Save } from 'lucide-react'

export default function DeliveryScheduleManagement() {
    const queryClient = useQueryClient()
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Form State
    const [isAvailable, setIsAvailable] = useState(true)
    const [procurementStaff, setProcurementStaff] = useState('')
    const [deliveryStaff, setDeliveryStaff] = useState('')
    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(0) // 0-6
    const [timeSlot, setTimeSlot] = useState('')

    // Fetch schedules for the current month
    const monthStr = format(currentMonth, 'yyyy-MM')
    const { data: schedules } = useQuery<DeliverySchedule[]>({
        queryKey: ['delivery-schedules', monthStr],
        queryFn: async () => {
            const res = await deliveryScheduleApi.list(monthStr)
            return res.data
        }
    })

    // Calendar Generation
    const calendarDays = useMemo(() => {
        const start = startOfMonth(currentMonth)
        const end = endOfMonth(currentMonth)

        // Adjust start to beginning of week (Sunday)
        const startDate = new Date(start)
        startDate.setDate(start.getDate() - startDate.getDay())

        // Adjust end to end of week (Saturday)
        const endDate = new Date(end)
        endDate.setDate(end.getDate() + (6 - end.getDay()))

        return eachDayOfInterval({ start: startDate, end: endDate })
    }, [currentMonth])

    const handleDateClick = (date: Date) => {
        setSelectedDate(date)

        // Find existing schedule
        const schedule = schedules?.find(s => s.date === format(date, 'yyyy-MM-dd'))

        if (schedule) {
            setIsAvailable(schedule.is_available)
            setProcurementStaff(schedule.procurement_staff || '')
            setDeliveryStaff(schedule.delivery_staff || '')
            setTimeSlot(schedule.time_slot || '')
        } else {
            // Default: Available, no staff
            setIsAvailable(true)
            setProcurementStaff('')
            setDeliveryStaff('')
            setTimeSlot('')
        }

        setSelectedDayOfWeek(getDay(date))
        setIsModalOpen(true)
    }

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            if (!selectedDate) return
            const dateStr = format(selectedDate, 'yyyy-MM-dd')
            await deliveryScheduleApi.update(dateStr, data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['delivery-schedules'] })
            setIsModalOpen(false)
        },
        onError: () => {
            alert('保存に失敗しました')
        }
    })

    const handleSave = () => {
        if (!selectedDate) return
        mutation.mutate({
            date: format(selectedDate, 'yyyy-MM-dd'),
            is_available: isAvailable,
            procurement_staff: procurementStaff,
            delivery_staff: deliveryStaff,
            time_slot: timeSlot,
            // Note: We don't really save day of week as it is derived, 
            // but if the backend schema needed it, we would send it.
            // Current schema doesn't have day_of_week column.
        })
    }

    const weekDays = ['日', '月', '火', '水', '木', '金', '土']
    const timeSlotOptions = [
        { value: '', label: '指定なし' },
        { value: '12:00～14:00', label: '12:00～14:00' },
        { value: '14:00～16:00', label: '14:00～16:00' },
        { value: '16:00～18:00', label: '16:00～18:00' },
    ]

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">配送スケジュール管理</h2>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-lg font-bold">
                        {format(currentMonth, 'yyyy年 M月', { locale: ja })}
                    </span>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-2 hover:bg-gray-100 rounded-full"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 border-t border-l">
                {weekDays.map((day, idx) => (
                    <div key={idx} className={`p-2 text-center text-sm font-bold border-r border-b bg-gray-50 ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}`}>
                        {day}
                    </div>
                ))}

                {calendarDays.map((date, idx) => {
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const schedule = schedules?.find(s => s.date === dateStr)
                    const isCurrentMonth = isSameMonth(date, currentMonth)

                    // Determine if available: 
                    // If schedule exists, use its flag.
                    // If not, default? User said "Selectable days should be circled".
                    // Usually implicit availability is false until set? Or true?
                    // Let's assume default is FALSE (blank), and circle means explicitly SET to available.
                    // Or maybe user wants to see circles for available days.
                    const available = schedule?.is_available

                    return (
                        <div
                            key={idx}
                            onClick={() => handleDateClick(date)}
                            className={`
                                h-24 p-1 border-r border-b cursor-pointer transition-colors relative
                                ${isCurrentMonth ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 text-gray-400'}
                            `}
                        >
                            <span className={`
                                text-sm w-6 h-6 flex items-center justify-center rounded-full
                                ${isSameDay(date, new Date()) ? 'bg-blue-600 text-white' : ''}
                            `}>
                                {format(date, 'd')}
                            </span>

                            {/* Visual Indicators */}
                            {available && (
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                    <div className="w-8 h-8 border-2 border-red-500 rounded-full opacity-50"></div>
                                </div>
                            )}

                            {/* Staff Info Preview */}
                            {(schedule?.procurement_staff || schedule?.delivery_staff) && (
                                <div className="mt-4 text-[10px] text-gray-600 leading-tight pl-1">
                                    {schedule.procurement_staff && <div className="truncate">仕: {schedule.procurement_staff}</div>}
                                    {schedule.delivery_staff && <div className="truncate">配: {schedule.delivery_staff}</div>}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-bold">
                                {format(selectedDate, 'yyyy年M月d日 (E)', { locale: ja })} の設定
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Availability Toggle */}
                            <div className="flex items-center justify-between">
                                <label className="font-bold text-gray-700">配送可能日</label>
                                <button
                                    onClick={() => setIsAvailable(!isAvailable)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isAvailable ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAvailable ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>

                            {/* Staff Inputs */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">仕入れ担当者</label>
                                <input
                                    type="text"
                                    value={procurementStaff}
                                    onChange={(e) => setProcurementStaff(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="名前を入力"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">配送担当者</label>
                                <input
                                    type="text"
                                    value={deliveryStaff}
                                    onChange={(e) => setDeliveryStaff(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="名前を入力"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">配送可能時間</label>
                                <select
                                    value={timeSlot}
                                    onChange={(e) => setTimeSlot(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {timeSlotOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Day of Week Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">曜日設定 (表示)</label>
                                <select
                                    value={selectedDayOfWeek}
                                    onChange={(e) => setSelectedDayOfWeek(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded px-3 py-2"
                                >
                                    {weekDays.map((day, idx) => (
                                        <option key={idx} value={idx}>{day}曜日</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">※ 基本的には日付に基づいて自動設定されますが、変更が必要な場合はこちらで選択してください。</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm"
                            >
                                <Save className="w-4 h-4" />
                                保存する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
