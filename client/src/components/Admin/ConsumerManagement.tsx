import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Phone, MapPin, Calendar, MessageCircle, Edit2, Trash2, X, Save, User } from 'lucide-react'
import { toast } from 'sonner'
import { adminConsumerApi } from '@/services/api'
import type { Consumer } from '@/types'

const ConsumerManagement = () => {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null)
    const [showMessages, setShowMessages] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState<Partial<Consumer>>({})

    // 消費者一覧取得
    const { data: consumersData, isLoading } = useQuery({
        queryKey: ['admin-consumers'],
        queryFn: async () => {
            const response = await adminConsumerApi.list({ limit: 200 })
            return response.data
        }
    })

    // 選択された消費者の応援メッセージ取得
    const { data: messages = [] } = useQuery({
        queryKey: ['admin-consumer-messages', selectedConsumer?.id],
        queryFn: async () => {
            if (!selectedConsumer) return []
            const response = await adminConsumerApi.getMessages(selectedConsumer.id)
            return response.data
        },
        enabled: !!selectedConsumer && showMessages
    })

    // 更新Mutation
    const updateMutation = useMutation({
        mutationFn: async (data: { id: number; payload: Partial<Consumer> }) => {
            return await adminConsumerApi.update(data.id, data.payload)
        },
        onSuccess: () => {
            toast.success('消費者情報を更新しました')
            queryClient.invalidateQueries({ queryKey: ['admin-consumers'] })
            setIsEditing(false)
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail || '更新に失敗しました')
        }
    })

    // 削除Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return await adminConsumerApi.delete(id)
        },
        onSuccess: () => {
            toast.success('消費者を削除しました')
            queryClient.invalidateQueries({ queryKey: ['admin-consumers'] })
            setSelectedConsumer(null)
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail || '削除に失敗しました')
        }
    })

    const consumers = consumersData?.items || []

    // 検索フィルター
    const filteredConsumers = consumers.filter((consumer: Consumer) =>
        consumer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        consumer.phone_number.includes(searchQuery) ||
        (consumer.address?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    )

    const handleEdit = () => {
        if (selectedConsumer) {
            setEditForm({
                name: selectedConsumer.name,
                phone_number: selectedConsumer.phone_number,
                postal_code: selectedConsumer.postal_code,
                address: selectedConsumer.address,
                building: selectedConsumer.building || '',
                profile_image_url: selectedConsumer.profile_image_url || ''
            })
            setIsEditing(true)
        }
    }

    const handleSave = () => {
        if (selectedConsumer) {
            updateMutation.mutate({
                id: selectedConsumer.id,
                payload: editForm
            })
        }
    }

    const handleDelete = () => {
        if (selectedConsumer && confirm(`${selectedConsumer.name} さんを削除してもよろしいですか？\n\nこの操作は取り消せません。`)) {
            deleteMutation.mutate(selectedConsumer.id)
        }
    }

    const handleCancel = () => {
        setIsEditing(false)
        setEditForm({})
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">消費者管理</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        登録消費者: {consumers.length} 名
                    </p>
                </div>
            </div>

            {/* 検索バー */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="名前、電話番号、住所で検索..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 消費者一覧 */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">消費者一覧</h3>
                    </div>

                    <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                        {isLoading ? (
                            <div className="p-8 text-center text-gray-500">
                                読み込み中...
                            </div>
                        ) : filteredConsumers.length > 0 ? (
                            filteredConsumers.map((consumer: Consumer) => (
                                <div
                                    key={consumer.id}
                                    onClick={() => {
                                        setSelectedConsumer(consumer)
                                        setShowMessages(false)
                                        setIsEditing(false)
                                    }}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer transition ${selectedConsumer?.id === consumer.id ? 'bg-emerald-50 border-l-4 border-emerald-600' : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                                                {consumer.profile_image_url ? (
                                                    <img
                                                        src={consumer.profile_image_url}
                                                        alt={consumer.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <User size={20} className="text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900">{consumer.name}</h4>
                                                <div className="mt-1 space-y-1">
                                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                                        <Phone size={14} />
                                                        {consumer.phone_number}
                                                    </p>
                                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                                        <MapPin size={14} />
                                                        〒{consumer.postal_code || '---'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-gray-500">
                                                ID: {consumer.id}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500">
                                該当する消費者が見つかりません
                            </div>
                        )}
                    </div>
                </div>

                {/* 消費者詳細 */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">詳細情報</h3>
                        {selectedConsumer && !isEditing && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleEdit}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="編集"
                                >
                                    <Edit2 size={18} />
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="削除"
                                    disabled={deleteMutation.isPending}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                        {isEditing && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={updateMutation.isPending}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    保存
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                                >
                                    <X size={16} />
                                    キャンセル
                                </button>
                            </div>
                        )}
                    </div>

                    {selectedConsumer ? (
                        <div className="p-6 space-y-6">
                            {isEditing ? (
                                <>
                                    {/* 編集フォーム */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">基本情報</h4>
                                        <div className="flex items-center gap-4 mb-4">
                                            {/* Avatar Edit Preview */}
                                            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                                                {editForm.profile_image_url ? (
                                                    <img
                                                        src={editForm.profile_image_url}
                                                        alt="preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <User size={32} className="text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 mb-1">プロフィール画像URL</label>
                                                <input
                                                    type="text"
                                                    value={editForm.profile_image_url || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, profile_image_url: e.target.value })}
                                                    placeholder="https://..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">氏名</label>
                                                <input
                                                    type="text"
                                                    value={editForm.name || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">電話番号</label>
                                                <input
                                                    type="tel"
                                                    value={editForm.phone_number || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">配送先情報</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">郵便番号</label>
                                                <input
                                                    type="text"
                                                    value={editForm.postal_code || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                                                    placeholder="1234567"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">住所</label>
                                                <textarea
                                                    value={editForm.address || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                                    rows={2}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">建物名・部屋番号（任意）</label>
                                                <input
                                                    type="text"
                                                    value={editForm.building || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, building: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* 基本情報 */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">基本情報</h4>
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-emerald-100 flex-shrink-0 shadow-sm">
                                                {selectedConsumer.profile_image_url ? (
                                                    <img
                                                        src={selectedConsumer.profile_image_url}
                                                        alt={selectedConsumer.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <User size={40} className="text-gray-300" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">氏名</p>
                                                <p className="text-xl font-bold text-gray-900">{selectedConsumer.name}</p>
                                                <p className="text-xs text-gray-400 mt-1">ID: {selectedConsumer.id}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-gray-500">電話番号</p>
                                                <p className="text-sm font-medium text-gray-900">{selectedConsumer.phone_number}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">LINE User ID</p>
                                                <p className="text-sm font-mono text-gray-900 break-all">{selectedConsumer.line_user_id}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 配送先情報 */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">配送先情報</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-gray-500">郵便番号</p>
                                                <p className="text-sm font-medium text-gray-900">{selectedConsumer.postal_code ? `〒${selectedConsumer.postal_code}` : '未登録'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">住所</p>
                                                <p className="text-sm font-medium text-gray-900">{selectedConsumer.address || '未登録'}</p>
                                            </div>
                                            {selectedConsumer.building && (
                                                <div>
                                                    <p className="text-xs text-gray-500">建物名・部屋番号</p>
                                                    <p className="text-sm font-medium text-gray-900">{selectedConsumer.building}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 登録情報 */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3">登録情報</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-gray-500">登録日時</p>
                                                <p className="text-sm font-medium text-gray-900 flex items-center gap-1">
                                                    <Calendar size={14} />
                                                    {new Date(selectedConsumer.created_at).toLocaleString('ja-JP')}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">最終更新</p>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {new Date(selectedConsumer.updated_at).toLocaleString('ja-JP')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 応援メッセージ */}
                                    <div>
                                        <button
                                            onClick={() => setShowMessages(!showMessages)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition"
                                        >
                                            <MessageCircle size={18} />
                                            {showMessages ? '応援メッセージを隠す' : '応援メッセージを表示'}
                                        </button>

                                        {showMessages && (
                                            <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
                                                {messages.length > 0 ? (
                                                    messages.map((msg: any) => (
                                                        <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-semibold text-gray-700">
                                                                    → {msg.farmer_name || '生産者'}
                                                                </span>
                                                                <span className="text-xs text-gray-500">
                                                                    {new Date(msg.created_at).toLocaleDateString('ja-JP')}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                                                {msg.message}
                                                            </p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-center text-gray-500 text-sm py-4">
                                                        応援メッセージはありません
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-gray-500">
                            左側から消費者を選択してください
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ConsumerManagement
