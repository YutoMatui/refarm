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
    const [selectedType, setSelectedType] = useState<DeliverySlotType>(DeliverySlotType.UNIVERSITY)
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

    // 選択された日付のスロットを取得
    const selectedDateSlots = slots.filter(
        (slot: DeliverySlot) =>
            slot.date === selectedDate &&
            slot.slot_type === selectedType
    )

    // 受取枠作成
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

    // 受取枠削除
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

        // 各時間帯ごとに受取枠を作成
        for (const slot of validSlots) {
            const timeText = `${slot.startTime}～${slot.endTime}`
            await createMutation.mutateAsync({
                date: selectedDate,
                slot_type: selectedType,
                start_time: slot.startTime || null,
                end_time: slot.endTime || null,
                time_text: timeText,
                is_active: true,
                note: note.trim() || null
            })
        }
    }

    // 今日以降の日付のみ選択可能
    const today = new Date().toISOString().split('T')[0]

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="text-emerald-600" size={24} />
                    消費者向け配送スケジュール管理
                </h2>

                {/* 日付選択 */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        配送日を選択
                    </label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        min={today}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                {/* 受取場所タイプ選択 */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        受取場所タイプ
                    </label>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <p className="text-xs text-blue-700">
                            <strong>兵庫県立大学:</strong> 大学での受取専用の時間枠<br />
                            <strong>自宅配送:</strong> 自宅配送専用の時間枠（飲食店配送と同じ）
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setSelectedType(DeliverySlotType.UNIVERSITY)}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition-all ${selectedType === DeliverySlotType.UNIVERSITY
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <MapPin size={18} className="inline mr-2" />
                            🏫 兵庫県立大学
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedType(DeliverySlotType.HOME)}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 font-semibold transition-all ${selectedType === DeliverySlotType.HOME
                                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            🏠 自宅配送
                        </button>
                    </div>
                </div>

                {/* 時間帯設定 */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Clock size={16} />
                        受取時間帯（複数設定可能）
                    </label>
                    <div className="space-y-3">
                        {timeSlots.map((slot, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <input
                                    type="time"
                                    value={slot.startTime}
                                    onChange={(e) => handleTimeSlotChange(index, 'startTime', e.target.value)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <span className="text-gray-500">～</span>
                                <input
                                    type="time"
                                    value={slot.endTime}
                                    onChange={(e) => handleTimeSlotChange(index, 'endTime', e.target.value)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                {timeSlots.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTimeSlot(index)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={handleAddTimeSlot}
                        className="mt-3 flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
                    >
                        <Plus size={16} />
                        時間帯を追加
                    </button>
                </div>

                {/* 備考 */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        備考（任意）
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="例: 雨天時は中止の場合があります"
                        rows={3}
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>

                {/* 作成ボタン */}
                <button
                    type="button"
                    onClick={handleCreateSlots}
                    disabled={!selectedDate || createMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {createMutation.isPending ? '作成中...' : '受取枠を作成'}
                </button>
            </div>

            {/* 選択された日付の受取枠一覧 */}
            {selectedDate && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                        {selectedDate} の受取枠（{selectedType === DeliverySlotType.UNIVERSITY ? '兵庫県立大学' : '自宅配送'}）
                    </h3>

                    {selectedDateSlots.length > 0 ? (
                        <div className="space-y-2">
                            {selectedDateSlots.map((slot: DeliverySlot) => (
                                <div
                                    key={slot.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <Clock className="text-emerald-600" size={20} />
                                        <div>
                                            <p className="font-semibold text-gray-900">{slot.time_text}</p>
                                            {slot.note && (
                                                <p className="text-sm text-gray-500 mt-1">{slot.note}</p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirm('この受取枠を削除しますか？')) {
                                                deleteMutation.mutate(slot.id)
                                            }
                                        }}
                                        className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-8">
                            この日の受取枠はまだ設定されていません
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}

export default ConsumerDeliverySlotManagement
