import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Phone, MapPin, Calendar, MessageCircle } from 'lucide-react'
import axios from 'axios'
import type { Consumer } from '@/types'

const ConsumerManagement = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null)
    const [showMessages, setShowMessages] = useState(false)

    // 消費者一覧取得
    const { data: consumersData, isLoading } = useQuery({
        queryKey: ['admin-consumers'],
        queryFn: async () => {
            const response = await axios.get('/api/admin/consumers/')
            return response.data
        }
    })

    // 選択された消費者の応援メッセージ取得
    const { data: messages = [] } = useQuery({
        queryKey: ['admin-consumer-messages', selectedConsumer?.id],
        queryFn: async () => {
            if (!selectedConsumer) return []
            const response = await axios.get(`/api/admin/consumers/${selectedConsumer.id}/messages`)
            return response.data
        },
        enabled: !!selectedConsumer && showMessages
    })

    const consumers = consumersData?.items || []

    // 検索フィルター
    const filteredConsumers = consumers.filter((consumer: Consumer) =>
        consumer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        consumer.phone_number.includes(searchQuery) ||
        consumer.address.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
                                    }}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer transition ${selectedConsumer?.id === consumer.id ? 'bg-emerald-50 border-l-4 border-emerald-600' : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900">{consumer.name}</h4>
                                            <div className="mt-2 space-y-1">
                                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                                    <Phone size={14} />
                                                    {consumer.phone_number}
                                                </p>
                                                <p className="text-sm text-gray-600 flex items-center gap-1">
                                                    <MapPin size={14} />
                                                    〒{consumer.postal_code}
                                                </p>
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
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="font-semibold text-gray-900">詳細情報</h3>
                    </div>

                    {selectedConsumer ? (
                        <div className="p-6 space-y-6">
                            {/* 基本情報 */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">基本情報</h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-500">氏名</p>
                                        <p className="text-sm font-medium text-gray-900">{selectedConsumer.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">電話番号</p>
                                        <p className="text-sm font-medium text-gray-900">{selectedConsumer.phone_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">LINE User ID</p>
                                        <p className="text-sm font-mono text-gray-900">{selectedConsumer.line_user_id}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 配送先情報 */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">配送先情報</h4>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-gray-500">郵便番号</p>
                                        <p className="text-sm font-medium text-gray-900">〒{selectedConsumer.postal_code}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">住所</p>
                                        <p className="text-sm font-medium text-gray-900">{selectedConsumer.address}</p>
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
                                                            → {msg.farmer_name}
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
