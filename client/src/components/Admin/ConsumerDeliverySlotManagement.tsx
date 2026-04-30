import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Calendar, Clock, Plus, X, MapPin } from 'lucide-react'
import { adminDeliverySlotApi } from '@/services/api'
import { DeliverySlotType, type DeliverySlot } from '@/types'

interface TimeSlot {
    startTime: string
    endTime: string
}

const ConsumerDeliverySlotManagement = () => {
    const queryClient = useQueryClient()
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([{ startTime: '', endTime: '' }])
    const [note, setNote] = useState('')

    // 受取枠一覧を取得
    const { data: slotsData } = useQuery({
        queryKey: ['consumer-delivery-slots'],
        queryFn: async () => {
            const response = await adminDeliverySlotApi.list({ limit: 200 })
            return response.data
        }
    })

    const slots = slotsData?.items ?? []

    // 今後の受取枠をまとめて表示
    const today = new Date().toISOString().split('T')[0]
    const upcomingSlots = slots
        .filter((slot: DeliverySlot) => slot.date >= today && slot.slot_type === DeliverySlotType.UNIVERSITY)
        .sort((a: DeliverySlot, b: DeliverySlot) => a.date.localeCompare(b.date))

    // 日付ごとにグループ化
    const slotsByDate = upcomingSlots.reduce((acc: Record<string, DeliverySlot[]>, slot: DeliverySlot) => {
        if (!acc[slot.date]) acc[slot.date] = []
        acc[slot.date].push(slot)
        return acc
    }, {} as Record<string, DeliverySlot[]>)

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            return await adminDeliverySlotApi.create(data)
        },
        onSuccess: () => {
            toast.success('受取枠を作成しました')
            queryClient.invalidateQueries({ queryKey: ['consumer-delivery-slots'] })
            setTimeSlots([{ startTime: '', endTime: '' }])
            setNote('')
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail || '作成に失敗しました')
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminDeliverySlotApi.delete(id),
        onSuccess: () => {
            toast.success('受取枠を削除しました')
            queryClient.invalidateQueries({ queryKey: ['consumer-delivery-slots'] })
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail || '削除に失敗しました')
        }
    })

    const handleAddTimeSlot = () => {
        setTimeSlots([...timeSlots, { startTime: '', endTime: '' }])
    }

    const handleRemoveTimeSlot = (index: number) => {
        setTimeSlots(timeSlots.filter((_, i) => i !== index))
    }

    const handleTimeSlotChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
        const newSlots = [...timeSlots]
        newSlots[index][field] = value
        setTimeSlots(newSlots)
    }

    const handleCreateSlots = async () => {
        if (!selectedDate) {
            toast.error('日付を選択してください')
            return
        }

        const validSlots = timeSlots.filter(slot => slot.startTime && slot.endTime)
        if (validSlots.length === 0) {
            toast.error('時間帯を入力してください')
            return
        }

        for (const slot of validSlots) {
            const timeText = `${slot.startTime}～${slot.endTime}`
            await createMutation.mutateAsync({
                date: selectedDate,
                slot_type: DeliverySlotType.UNIVERSITY,
                start_time: slot.startTime || null,
                end_time: slot.endTime || null,
                time_text: timeText,
                is_active: true,
                note: note.trim() || null
            })
        }
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00')
        const weekdays = ['日', '月', '火', '水', '木', '金', '土']
        return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
    }

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex items-center gap-3">
                <MapPin className="text-emerald-600" size={24} />
                <div>
                    <h2 className="text-xl font-bold text-gray-900">ユニバードーム 受取枠管理</h2>
                    <p className="text-sm text-gray-500">消費者がアプリから選べる受取時間帯を設定します</p>
                </div>
            </div>

            {/* 受取枠作成フォーム */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-emerald-600" />
                    新しい受取枠を追加
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* 日付選択 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            受取日
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={today}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>

                    {/* 備考 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            備考（任意）
                        </label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="例: 雨天中止の場合あり"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>

                {/* 時間帯設定 */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Clock size={14} />
                        受取時間帯
                    </label>
                    <div className="space-y-2">
                        {timeSlots.map((slot, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) => handleTimeSlotChange(index, 'startTime', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <span className="text-gray-400">～</span>
                                <input
                                    type="time"
                                    value={slot.endTime}
                                    onChange={(e) => handleTimeSlotChange(index, 'endTime', e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                {timeSlots.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTimeSlot(index)}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleAddTimeSlot}
                        className="mt-2 flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                        <Plus size={14} />
                        時間帯を追加
                    </button>
                </div>

                <button
                    type="button"
                    onClick={handleCreateSlots}
                    disabled={!selectedDate || createMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {createMutation.isPending ? '作成中...' : '受取枠を作成'}
                </button>
            </div>

            {/* 今後の受取枠一覧 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-emerald-600" />
                    今後の受取枠
                </h3>

                {Object.keys(slotsByDate).length > 0 ? (
                    <div className="space-y-4">
                        {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                            <div key={date} className="border border-gray-100 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                                    <p className="font-semibold text-gray-800">{formatDate(date)}</p>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {(dateSlots as DeliverySlot[]).map((slot) => (
                                        <div
                                            key={slot.id}
                                            className="flex items-center justify-between px-4 py-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Clock className="text-emerald-500" size={16} />
                                                <span className="font-medium text-gray-900">{slot.time_text}</span>
                                                {slot.note && (
                                                    <span className="text-xs text-gray-400">({slot.note})</span>
                                                )}
                                                {!slot.is_active && (
                                                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">非公開</span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (confirm('この受取枠を削除しますか？')) {
                                                        deleteMutation.mutate(slot.id)
                                                    }
                                                }}
                                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-400">
                        <Calendar className="mx-auto mb-2" size={32} />
                        <p>今後の受取枠はまだ設定されていません</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ConsumerDeliverySlotManagement
