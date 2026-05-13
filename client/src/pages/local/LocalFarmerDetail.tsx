import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft,
    Loader2,
    Leaf,
    PlayCircle,
    ExternalLink,
    MessageCircle,
    Send,
    Award,
    MapPin,
    Heart
} from 'lucide-react'
import { toast } from 'sonner'
import { farmerApi, productApi, supportMessageApi } from '@/services/api'
import type { Farmer, Product, Commitment, Achievement } from '@/types'

interface SupportMessage {
    id: number
    consumer_name: string
    message: string
    created_at: string
}

const LocalFarmerDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'products' | 'story'>('products')
    const [showMessageForm, setShowMessageForm] = useState(false)
    const [message, setMessage] = useState('')
    const [nickname, setNickname] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const queryClient = useQueryClient()

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [id])

    // 生産者情報取得
    const { data: farmer, isLoading } = useQuery({
        queryKey: ['local-farmer', id],
        queryFn: async () => {
            if (!id) return null
            const res = await farmerApi.getById(parseInt(id))
            return res.data as Farmer
        },
        enabled: !!id
    })

    // 商品一覧取得
    const { data: productsData } = useQuery({
        queryKey: ['local-farmer-products', id],
        queryFn: async () => {
            if (!id) return null
            return (await productApi.list({ farmer_id: parseInt(id), is_active: 1, limit: 100 })).data
        },
        enabled: !!id
    })

    // 応援メッセージ一覧取得
    const { data: supportMessages = [], isLoading: messagesLoading } = useQuery<SupportMessage[]>({
        queryKey: ['support-messages', id],
        queryFn: async () => {
            if (!id) return []
            const response = await supportMessageApi.getFarmerMessages(parseInt(id))
            return response.data || []
        },
        enabled: !!id
    })

    // 応援メッセージ送信
    const sendMessageMutation = useMutation({
        mutationFn: async (data: { farmer_id: number; message: string; nickname?: string }) => {
            return await supportMessageApi.create(data)
        },
        onSuccess: () => {
            toast.success('🎉 応援メッセージを送信しました！')
            setMessage('')
            setNickname('')
            setShowMessageForm(false)
            queryClient.invalidateQueries({ queryKey: ['support-messages', id] })
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail || '送信に失敗しました')
        }
    })

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!id || !message.trim()) {
            toast.error('メッセージを入力してください')
            return
        }

        setIsSubmitting(true)
        try {
            await sendMessageMutation.mutateAsync({
                farmer_id: parseInt(id),
                message: message.trim(),
                nickname: nickname.trim() || undefined
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-b from-emerald-50 to-white">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
                <p className="text-sm text-gray-500">生産者情報を読み込み中...</p>
            </div>
        )
    }

    if (!farmer) {
        return (
            <div className="flex flex-col justify-center items-center h-screen">
                <Leaf className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">生産者が見つかりません</p>
                <button
                    onClick={() => navigate('/local/farmers')}
                    className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                    生産者一覧に戻る
                </button>
            </div>
        )
    }

    const products = productsData?.items || []
    const commitments = (farmer.commitments || []) as Commitment[]
    const videoUrls = (farmer.video_url || []) as string[]
    const articleUrls = (farmer.article_url || []) as string[]
    const achievements = (farmer.achievements || []) as Achievement[]

    return (
        <div className="bg-white min-h-screen pb-20">
            {/* Fixed Header */}
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 h-14 flex items-center justify-between shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-emerald-600 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="font-bold text-gray-900 text-base">{farmer.name}</span>
                </div>
                <div className="w-10" />
            </div>

            {/* Hero Section with Cover & Profile */}
            <div className="relative">
                <div className="relative h-56 w-full overflow-hidden">
                    {farmer.cover_photo_url ? (
                        <img
                            src={farmer.cover_photo_url}
                            alt="cover"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-400 via-emerald-300 to-green-200 flex items-center justify-center">
                            <Leaf className="w-20 h-20 text-white/30" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>

                <div className="px-4 -mt-12 relative z-10">
                    <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-xl overflow-hidden">
                        {farmer.profile_photo_url ? (
                            <img
                                src={farmer.profile_photo_url}
                                alt={farmer.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-100 to-emerald-50 text-4xl">
                                👨‍🌾
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Farmer Profile Info */}
            <div className="px-4 pt-4 pb-3">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{farmer.name}</h1>
                {farmer.main_crop && (
                    <div className="flex items-center gap-2 mb-2">
                        <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                            {farmer.main_crop}
                        </div>
                    </div>
                )}
                {farmer.address && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                        <MapPin size={14} />
                        <span>{farmer.address}</span>
                    </div>
                )}
                {farmer.bio && (
                    <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
                        {farmer.bio}
                    </p>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="sticky top-14 z-30 bg-white border-b border-gray-200 flex">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'products'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    販売商品 ({products.length})
                </button>
                <button
                    onClick={() => setActiveTab('story')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'story'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    こだわり・実績
                </button>
            </div>

            {/* Main Content */}
            <div className="px-4 py-5">
                {/* TAB 1: 販売商品 */}
                {activeTab === 'products' && (
                    <div className="space-y-6">
                        {/* 商品グリッド */}
                        {products.length > 0 ? (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Leaf className="text-emerald-600" size={20} />
                                    販売中の野菜
                                </h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {products.map((product: Product) => {
                                        const priceWithTax = Math.round(parseFloat(product.price) * (1 + (product.tax_rate || 8) / 100))
                                        return (
                                            <div
                                                key={product.id}
                                                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                                                onClick={() => navigate(`/local/products/${product.id}`)}
                                            >
                                                <div className="h-32 bg-gray-100 overflow-hidden">
                                                    {product.image_url ? (
                                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-3xl">🥬</div>
                                                    )}
                                                </div>
                                                <div className="p-3">
                                                    <h3 className="font-bold text-sm text-gray-900 line-clamp-2 mb-1">{product.name}</h3>
                                                    <p className="text-emerald-700 font-bold text-base">¥{priceWithTax}<span className="text-xs text-gray-500 font-normal ml-1">/{product.unit}</span></p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-dashed border-gray-200">
                                <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-600 font-semibold mb-1">現在販売中の商品はありません</p>
                                <p className="text-xs text-gray-400">次回の収穫をお楽しみに！</p>
                            </div>
                        )}

                        {/* 応援メッセージセクション */}
                        <div className="pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <MessageCircle className="text-emerald-600" size={20} />
                                    みんなの応援メッセージ
                                    {supportMessages.length > 0 && (
                                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                                            {supportMessages.length}
                                        </span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowMessageForm(!showMessageForm)}
                                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${showMessageForm
                                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                                        }`}
                                >
                                    {showMessageForm ? 'キャンセル' : '応援する'}
                                </button>
                            </div>

                            {/* 応援メッセージフォーム */}
                            {showMessageForm && (
                                <form
                                    onSubmit={handleSendMessage}
                                    className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 mb-5 space-y-4 shadow-sm border border-emerald-100"
                                >
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1">
                                            <MessageCircle size={16} className="text-emerald-600" />
                                            応援メッセージ
                                            <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="生産者さんへの応援メッセージを書いてください&#10;&#10;例: いつも新鮮で美味しい野菜をありがとうございます！これからも応援しています！"
                                            required
                                            maxLength={1000}
                                            rows={5}
                                            className="w-full rounded-xl border-2 border-emerald-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm"
                                        />
                                        <p className="text-xs text-gray-600 mt-2 flex items-center justify-between">
                                            <span>{message.length} / 1000 文字</span>
                                            {message.length > 900 && (
                                                <span className="text-orange-600 font-semibold">残り{1000 - message.length}文字</span>
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-800 mb-2">
                                            ニックネーム（任意）
                                        </label>
                                        <input
                                            type="text"
                                            value={nickname}
                                            onChange={(e) => setNickname(e.target.value)}
                                            placeholder="例: 野菜大好きさん"
                                            maxLength={100}
                                            className="w-full rounded-xl border-2 border-emerald-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            省略した場合は会員名で表示されます
                                        </p>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !message.trim()}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                送信中...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                応援メッセージを送る
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* 応援メッセージ一覧 */}
                            {messagesLoading ? (
                                <div className="text-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                                </div>
                            ) : supportMessages.length > 0 ? (
                                <div className="space-y-3">
                                    {supportMessages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm">
                                                        👤
                                                    </div>
                                                    <span className="font-semibold text-gray-900 text-sm">
                                                        {msg.consumer_name}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(msg.created_at).toLocaleDateString('ja-JP', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap pl-10">
                                                {msg.message}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-dashed border-gray-200">
                                    <Heart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-600 font-medium mb-1">まだ応援メッセージがありません</p>
                                    <p className="text-xs text-gray-400">最初の応援者になりましょう！</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: こだわり・実績 */}
                {activeTab === 'story' && (
                    <div className="space-y-6">
                        {/* 紹介動画セクション（最上部） */}
                        {videoUrls.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <PlayCircle size={20} className="text-emerald-600" />
                                    紹介動画
                                </h2>
                                <div className="space-y-3">
                                    {videoUrls.map((url, idx) => (
                                        <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <PlayCircle size={18} className="text-emerald-600 shrink-0" />
                                                <span className="font-semibold text-sm text-gray-700 truncate">
                                                    紹介動画を見る{videoUrls.length > 1 ? ` (${idx + 1})` : ''}
                                                </span>
                                            </div>
                                            <ExternalLink size={16} className="text-gray-400" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-100">
                            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <Leaf className="text-emerald-600" size={20} />
                                こだわり
                            </h2>
                            {farmer.kodawari ? (
                                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                    {farmer.kodawari}
                                </p>
                            ) : farmer.bio ? (
                                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                    {farmer.bio}
                                </p>
                            ) : (
                                <p className="text-gray-400 text-sm">こだわり情報はまだありません</p>
                            )}
                        </div>

                        {/* こだわりブロック */}
                        {commitments.length > 0 && (
                            <div className="space-y-4">
                                {commitments.map((block, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition-shadow"
                                    >
                                        {block.image_url && (
                                            <img
                                                src={block.image_url}
                                                alt={block.title}
                                                className="w-full h-52 object-cover"
                                            />
                                        )}
                                        <div className="p-5">
                                            <h3 className="font-bold text-gray-900 mb-2 text-base">{block.title}</h3>
                                            <p className="text-sm text-gray-600 leading-relaxed">{block.body}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 記事セクション */}
                        {articleUrls.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <ExternalLink size={20} className="text-blue-500" />
                                    インタビュー記事
                                </h2>
                                <div className="space-y-3">
                                    {articleUrls.map((url, idx) => (
                                        <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-md transition-all"
                                        >
                                            <span className="font-semibold text-blue-700 text-sm">
                                                📰 記事を読む {articleUrls.length > 1 ? `(${idx + 1})` : ''}
                                            </span>
                                            <ExternalLink size={18} className="text-blue-500" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 実績セクション */}
                        {achievements.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Award className="text-yellow-500" size={20} />
                                    実績・受賞歴
                                </h2>
                                <div className="space-y-3">
                                    {achievements.map((achievement, idx) => (
                                        <div
                                            key={idx}
                                            className="flex gap-4 items-center bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-xl border border-yellow-100 shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            {achievement.image_url ? (
                                                <img
                                                    src={achievement.image_url}
                                                    alt=""
                                                    className="w-14 h-14 rounded-lg bg-white object-cover shadow-sm"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-lg bg-yellow-100 flex items-center justify-center text-2xl shadow-sm">
                                                    🏆
                                                </div>
                                            )}
                                            <span className="text-sm text-gray-800 font-semibold flex-1">
                                                {achievement.title}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 栽培情報 */}
                        {(farmer.farming_method || farmer.certifications) && (
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-5 border border-emerald-100">
                                <h3 className="font-bold text-emerald-800 mb-3 text-base flex items-center gap-2">
                                    <Leaf className="text-emerald-600" size={18} />
                                    栽培について
                                </h3>
                                {farmer.farming_method && (
                                    <p className="text-sm text-emerald-800 mb-2">
                                        <span className="font-semibold">栽培方法:</span> {farmer.farming_method}
                                    </p>
                                )}
                                {farmer.certifications && (
                                    <p className="text-sm text-emerald-800">
                                        <span className="font-semibold">認証:</span> {farmer.certifications}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}



export default LocalFarmerDetail
