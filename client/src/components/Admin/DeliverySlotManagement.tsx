import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { adminDeliverySlotApi } from '@/services/api'
import { DeliverySlotType, type DeliverySlot, type PaginatedResponse, type DeliverySlotUpdateRequest } from '@/types'

interface CreateFormState {
    date: string
    slotType: DeliverySlotType
    startTime: string
    endTime: string
    pointTime: string
    note: string
    isActive: boolean
}

const initialCreateForm: CreateFormState = {
    date: '',
    slotType: DeliverySlotType.HOME,
    startTime: '',
    endTime: '',
    pointTime: '',
    note: '',
    isActive: true,
}

const timeToInput = (value?: string | null) => {
    if (!value) return ''
    return value.slice(0, 5)
}

const formatDate = (value?: string | null) => {
    if (!value) return '-'
    try {
        return format(parseISO(value), 'yyyy/MM/dd')
    } catch (error) {
        return value
    }
}

const DeliverySlotManagement = () => {
    const queryClient = useQueryClient()
    const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm)
    const [editingSlot, setEditingSlot] = useState<DeliverySlot | null>(null)
    const [editForm, setEditForm] = useState<CreateFormState>(initialCreateForm)

    const { data, isLoading, isError } = useQuery({
        queryKey: ['admin-delivery-slots'],
        queryFn: async () => {
            const response = await adminDeliverySlotApi.list({ limit: 200 })
            return response.data as PaginatedResponse<DeliverySlot>
        }
    })

    const slots = useMemo(() => data?.items ?? [], [data])

    const createMutation = useMutation({
        mutationFn: adminDeliverySlotApi.create,
        onSuccess: () => {
            toast.success('受取枠を作成しました')
            setCreateForm(initialCreateForm)
            queryClient.invalidateQueries({ queryKey: ['admin-delivery-slots'] })
        },
        onError: (error: any) => {
            console.error('Create delivery slot failed', error)
            const message = error?.response?.data?.detail ?? '受取枠の作成に失敗しました'
            toast.error(message)
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: DeliverySlotUpdateRequest }) => adminDeliverySlotApi.update(id, payload),
        onSuccess: () => {
            toast.success('受取枠を更新しました')
            setEditingSlot(null)
            queryClient.invalidateQueries({ queryKey: ['admin-delivery-slots'] })
        },
        onError: (error: any) => {
            console.error('Update delivery slot failed', error)
            const message = error?.response?.data?.detail ?? '受取枠の更新に失敗しました'
            toast.error(message)
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminDeliverySlotApi.delete(id),
        onSuccess: () => {
            toast.success('受取枠を削除しました')
            queryClient.invalidateQueries({ queryKey: ['admin-delivery-slots'] })
        },
        onError: (error: any) => {
            console.error('Delete delivery slot failed', error)
            const message = error?.response?.data?.detail ?? '受取枠の削除に失敗しました'
            toast.error(message)
        }
    })

    const handleCreateChange = (field: keyof CreateFormState, value: string | boolean) => {
        if (field === 'slotType') {
            const nextType = value as DeliverySlotType
            setCreateForm(prev => ({
                ...prev,
                slotType: nextType,
                startTime: nextType === DeliverySlotType.HOME ? prev.startTime : '',
                endTime: nextType === DeliverySlotType.HOME ? prev.endTime : '',
                pointTime: nextType === DeliverySlotType.UNIVERSITY ? prev.pointTime : '',
            }))
            return
        }
        setCreateForm(prev => ({ ...prev, [field]: value }))
    }

    const handleEditChange = (field: keyof CreateFormState, value: string | boolean) => {
        if (field === 'slotType') {
            const nextType = value as DeliverySlotType
            setEditForm(prev => ({
                ...prev,
                slotType: nextType,
                startTime: nextType === DeliverySlotType.HOME ? prev.startTime : '',
                endTime: nextType === DeliverySlotType.HOME ? prev.endTime : '',
                pointTime: nextType === DeliverySlotType.UNIVERSITY ? prev.pointTime : '',
            }))
            return
        }
        setEditForm(prev => ({ ...prev, [field]: value }))
    }

    const buildPayload = (form: CreateFormState) => {
        if (!form.date) {
            throw new Error('日付を入力してください')
        }

        if (form.slotType === DeliverySlotType.HOME) {
            if (!form.startTime || !form.endTime) {
                throw new Error('開始時間と終了時間を入力してください')
            }
            return {
                date: form.date,
                slot_type: form.slotType,
                start_time: form.startTime,
                end_time: form.endTime,
                time_text: `${form.startTime}〜${form.endTime}`,
                note: form.note || undefined,
                is_active: form.isActive,
            }
        }

        if (!form.pointTime) {
            throw new Error('受取時間を入力してください')
        }

        return {
            date: form.date,
            slot_type: form.slotType,
            start_time: form.pointTime,
            end_time: undefined,
            time_text: form.pointTime,
            note: form.note || undefined,
            is_active: form.isActive,
        }
    }

    const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        try {
            const payload = buildPayload(createForm)
            createMutation.mutate(payload)
        } catch (error: any) {
            toast.error(error.message ?? '入力内容を確認してください')
        }
    }

    const startEdit = (slot: DeliverySlot) => {
        setEditingSlot(slot)
        setEditForm({
            date: slot.date ?? '',
            slotType: slot.slot_type,
            startTime: slot.slot_type === DeliverySlotType.HOME ? timeToInput(slot.start_time) : '',
            endTime: slot.slot_type === DeliverySlotType.HOME ? timeToInput(slot.end_time) : '',
            pointTime: slot.slot_type === DeliverySlotType.UNIVERSITY ? timeToInput(slot.start_time) : '',
            note: slot.note ?? '',
            isActive: Boolean(slot.is_active),
        })
    }

    const handleEditSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!editingSlot) return
        try {
            const payload = buildPayload(editForm)
            updateMutation.mutate({ id: editingSlot.id, payload })
        } catch (error: any) {
            toast.error(error.message ?? '入力内容を確認してください')
        }
    }

    const toggleActivation = (slot: DeliverySlot) => {
        updateMutation.mutate({ id: slot.id, payload: { is_active: !slot.is_active } })
    }

    return (
        <div className="space-y-8">
            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">受取枠の作成</h2>
                    <p className="text-sm text-gray-600">自宅配送と大学受取の枠を登録し、公開設定を切り替えられます。</p>
                </div>

                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateSubmit}>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">日付</label>
                        <input
                            type="date"
                            value={createForm.date}
                            onChange={(e) => handleCreateChange('date', e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">枠種別</label>
                        <select
                            value={createForm.slotType}
                            onChange={(e) => handleCreateChange('slotType', e.target.value as DeliverySlotType)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value={DeliverySlotType.HOME}>自宅配送</option>
                            <option value={DeliverySlotType.UNIVERSITY}>兵庫県立大学 正門受取</option>
                        </select>
                    </div>

                    {createForm.slotType === DeliverySlotType.HOME ? (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">開始時間</label>
                                <input
                                    type="time"
                                    value={createForm.startTime}
                                    onChange={(e) => handleCreateChange('startTime', e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">終了時間</label>
                                <input
                                    type="time"
                                    value={createForm.endTime}
                                    onChange={(e) => handleCreateChange('endTime', e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>
                        </>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">受取時間</label>
                            <input
                                type="time"
                                value={createForm.pointTime}
                                onChange={(e) => handleCreateChange('pointTime', e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-gray-700">備考</label>
                        <textarea
                            value={createForm.note}
                            onChange={(e) => handleCreateChange('note', e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="例）配送担当：田中"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            id="create-active"
                            type="checkbox"
                            checked={createForm.isActive}
                            onChange={(e) => handleCreateChange('isActive', e.target.checked)}
                            className="h-4 w-4 text-emerald-600 border-gray-300 rounded"
                        />
                        <label htmlFor="create-active" className="text-sm text-gray-700">公開する</label>
                    </div>

                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="inline-flex items-center justify-center px-5 py-2 bg-emerald-600 text-white font-semibold rounded-md hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {createMutation.isPending ? '登録中...' : '受取枠を追加する'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">受取枠一覧</h2>
                        <p className="text-sm text-gray-600">現在公開されている枠のみ消費者に表示されます。</p>
                    </div>
                    <span className="text-sm text-gray-500">全{slots.length}件</span>
                </div>

                {isLoading && <p className="text-sm text-gray-600">受取枠を読み込み中です...</p>}
                {isError && <p className="text-sm text-red-600">受取枠の取得に失敗しました。</p>}

                {!isLoading && slots.length === 0 && (
                    <p className="text-sm text-gray-600">受取枠が登録されていません。上部のフォームから追加してください。</p>
                )}

                {!isLoading && slots.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">種別</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">公開</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備考</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {slots.map(slot => (
                                    <tr key={slot.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-sm text-gray-700">{formatDate(slot.date)}</td>
                                        <td className="px-4 py-2 text-sm text-gray-700">{slot.slot_type === DeliverySlotType.HOME ? '自宅配送' : '大学受取'}</td>
                                        <td className="px-4 py-2 text-sm text-gray-700">{slot.time_text}</td>
                                        <td className="px-4 py-2 text-sm">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${slot.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {slot.is_active ? '公開中' : '非公開'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-600">{slot.note ?? '-'}</td>
                                        <td className="px-4 py-2 text-sm text-right space-x-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleActivation(slot)}
                                                className="inline-flex items-center px-3 py-1 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                {slot.is_active ? '非公開にする' : '公開する'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => startEdit(slot)}
                                                className="inline-flex items-center px-3 py-1 rounded-md border border-blue-300 text-sm text-blue-600 hover:bg-blue-50"
                                            >
                                                編集
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm('この受取枠を削除しますか？')) {
                                                        deleteMutation.mutate(slot.id)
                                                    }
                                                }}
                                                className="inline-flex items-center px-3 py-1 rounded-md border border-red-300 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                削除
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {editingSlot && (
                <section className="bg-white border border-blue-200 rounded-xl shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">受取枠の編集</h3>
                            <p className="text-sm text-gray-600">ID: {editingSlot.id} / {formatDate(editingSlot.date)} / {editingSlot.time_text}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEditingSlot(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            編集をキャンセル
                        </button>
                    </div>

                    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleEditSubmit}>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">日付</label>
                            <input
                                type="date"
                                value={editForm.date}
                                onChange={(e) => handleEditChange('date', e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">枠種別</label>
                            <select
                                value={editForm.slotType}
                                onChange={(e) => handleEditChange('slotType', e.target.value as DeliverySlotType)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={DeliverySlotType.HOME}>自宅配送</option>
                                <option value={DeliverySlotType.UNIVERSITY}>兵庫県立大学 正門受取</option>
                            </select>
                        </div>

                        {editForm.slotType === DeliverySlotType.HOME ? (
                            <>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">開始時間</label>
                                    <input
                                        type="time"
                                        value={editForm.startTime}
                                        onChange={(e) => handleEditChange('startTime', e.target.value)}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">終了時間</label>
                                    <input
                                        type="time"
                                        value={editForm.endTime}
                                        onChange={(e) => handleEditChange('endTime', e.target.value)}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">受取時間</label>
                                <input
                                    type="time"
                                    value={editForm.pointTime}
                                    onChange={(e) => handleEditChange('pointTime', e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>
                        )}

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium text-gray-700">備考</label>
                            <textarea
                                value={editForm.note}
                                onChange={(e) => handleEditChange('note', e.target.value)}
                                rows={2}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                id="edit-active"
                                type="checkbox"
                                checked={editForm.isActive}
                                onChange={(e) => handleEditChange('isActive', e.target.checked)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                            <label htmlFor="edit-active" className="text-sm text-gray-700">公開する</label>
                        </div>

                        <div className="md:col-span-2 space-x-3">
                            <button
                                type="submit"
                                disabled={updateMutation.isPending}
                                className="inline-flex items-center justify-center px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-60"
                            >
                                {updateMutation.isPending ? '更新中...' : '受取枠を更新する'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditingSlot(null)}
                                className="inline-flex items-center justify-center px-5 py-2 border border-gray-300 text-gray-700 font-semibold rounded-md hover:bg-gray-100"
                            >
                                キャンセル
                            </button>
                        </div>
                    </form>
                </section>
            )}
        </div>
    )
}

export default DeliverySlotManagement
