import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Leaf, PlayCircle, ExternalLink, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { farmerApi, productApi } from '@/services/api'
import { useStore } from '@/store/useStore'
import LocalProductCard from '@/components/local/LocalProductCard'
import type { Farmer, Product, Commitment, Achievement } from '@/types'
import axios from 'axios'

const LocalFarmerDetail = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'products' | 'story'>('products')
    const [showMessageForm, setShowMessageForm] = useState(false)
    const [message, setMessage] = useState('')
    const [nickname, setNickname] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const addToCart = useStore(state => state.addToCart)
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
    const { data: supportMessages = [] } = useQuery({
        queryKey: ['support-messages', id],
        queryFn: async () => {
            if (!id) return []
            const response = await axios.get(`/api/support-messages/farmer/${id}`)
            return response.data
        },
        enabled: !!id
    })

    // 応援メッセージ送信
    const sendMessageMutation = useMutation({
        mutationFn: async (data: { farmer_id: number; message: string; nickname?: string }) => {
            const response = await axios.post('/api/support-messages/', data)
            return response.data
        },
        onSuccess: () => {
            toast.success('応援メッセージを送信しました！')
            setMessage('')
            setNickname('')
            setShowMessageForm(false)
            queryClient.invalidateQueries({ queryKey: ['support-messages', id] })
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.detail || '送信に失敗しました')
        }
    })

    const handleAddToCart = (product: Product, quantity: number) => {
        addToCart(product, quantity)
        toast.success(`${product.name} をカートに追加しました`)
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!id || !message.trim()) return

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
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        )
    }

    if (!farmer) {
        return (
            <div className="p-8 text-center text-gray-500">
                生産者が見つかりません
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
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full border border-emerald-600 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="font-bold text-gray-900">{farmer.name}</span>
                </div>
                <div className="w-10" />
            </div>

            {/* Cover Image */}
            <div className="relative h-56 w-full overflow-hidden">
                {farmer.cover_photo_url ? (
                    <img src={farmer.cover_photo_url} alt="cover" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-emerald-100 to-emerald-50 flex items-center justify-center">
                        <Leaf className="w-16 h-16 text-emerald-200" />
                    </div>
                )}
                <div className="absolute bottom-4 left-4">
                    <div className="w-20 h-20 rounded-full border-4 border-white bg-white shadow-lg overflow-hidden">
                        {farmer.profile_photo_url ? (
                            <img src={farmer.profile_photo_url} alt={farmer.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-2xl">
                                👨‍🌾
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Farmer Info */}
            <div className="px-4 pt-4 pb-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{farmer.name}</h1>
                {farmer.bio && (
                    <p className="text-gray-600 text-sm leading-relaxed">{farmer.bio.split('\n')[0]}</p>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="sticky top-14 z-30 bg-white border-b border-gray-200 flex">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'products'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    販売商品({products.length})
                </button>
                <button
                    onClick={() => setActiveTab('story')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'story'
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    こだわり・実績
                </button>
            </div>

            {/* Main Content */}
            <div className="px-4 py-4">
                {/* TAB 1: 販売商品 */}
                {activeTab === 'products' && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">販売中の野菜</h2>

                        {products.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {products.map((product: Product) => (
                                    <LocalProductCard
                                        key={product.id}
                                        product={product}
                                        onAddToCart={handleAddToCart}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <Leaf className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 font-medium">現在販売中の商品はありません</p>
                                <p className="text-xs text-gray-400 mt-1">次回の収穫をお待ちください</p>
                            </div>
                        )}

                        {/* 応援メッセージセクション */}
                        <div className="pt-6 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <MessageCircle className="text-emerald-600" size={20} />
                                    みんなの応援メッセージ
                                </h3>
                                <button
                                    onClick={() => setShowMessageForm(!showMessageForm)}
                                    className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                                >
                                    {showMessageForm ? 'キャンセル' : '応援する'}
                                </button>
                            </div>

                            {/* 応援メッセージフォーム */}
                            {showMessageForm && (
                                <form onSubmit={handleSendMessage} className="bg-emerald-50 rounded-xl p-4 mb-4 space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            応援メッセージ <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="生産者さんへの応援メッセージを書いてください"
                                            required
                                            maxLength={1000}
                                            rows={4}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">{message.length} / 1000 文字 </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ニックネーム（任意）
                                        </label>
                                        <input
                                            type="text"
                                            value={nickname}
                                            onChange={(e) => setNickname(e.target.value)}
                                            placeholder="例: 野菜大好き"
                                            maxLength={100}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            省略した場合は会員名で表示されます
                                        </p>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !message.trim()}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? '送信中...' : '応援メッセージを送る'}
                                    </button>
                                </form>
                            )}

                            {/* 応援メッセージ一覧 */}
                            {supportMessages.length > 0 ? (
                                <div className="space-y-3">
                                    {supportMessages.map((msg: any) => (
                                        <div key={msg.id} className="bg-gray-50 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold text-gray-900 text-sm">
                                                    {msg.consumer_name}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(msg.created_at).toLocaleDateString('ja-JP')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                {msg.message}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    まだ応援メッセージがありません。最初の応援者になりましょう！
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 2: こだわり・実績 */}
                {activeTab === 'story' && (
                    <div className="space-y-6">
                        {/* こだわりセクション */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-3">こだわり</h2>
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
                                    <div key={idx} className="bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-100">
                                        {block.image_url && (
                                            <img src={block.image_url} alt={block.title} className="w-full h-48 object-cover" />
                                        )}
                                        <div className="p-4">
                                            <h3 className="font-bold text-gray-900 mb-2">{block.title}</h3>
                                            <p className="text-sm text-gray-600 leading-relaxed">{block.body}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 動画セクション */}
                        {videoUrls.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <PlayCircle size={20} className="text-red-500" />
                                    動画で見る
                                </h2>
                                <div className="space-y-3">
                                    {videoUrls.map((url, idx) => (
                                        <div key={idx} className="rounded-xl overflow-hidden bg-gray-100">
                                            {url.includes('youtube.com') || url.includes('youtu.be') ? (
                                                <iframe
                                                    src={convertToYouTubeEmbed(url)}
                                                    title={`${farmer.name} の動画 ${idx + 1}`}
                                                    className="w-full aspect-video"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                />
                                            ) : (
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center py-8 text-red-600 hover:text-red-700"
                                                >
                                                    <PlayCircle size={48} />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 記事セクション */}
                        {articleUrls.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <ExternalLink size={20} className="text-blue-500" />
                                    インタビュー記事
                                </h2>
                                <div className="space-y-2">
                                    {articleUrls.map((url, idx) => (
                                        <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors"
                                        >
                                            <span className="font-medium text-blue-700 text-sm">
                                                記事を読む {articleUrls.length > 1 ? `(${idx + 1})` : ''}
                                            </span>
                                            <ExternalLink size={16} className="text-blue-500" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 実績セクション */}
                        {achievements.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3">実績・受賞歴</h2>
                                <div className="space-y-3">
                                    {achievements.map((achievement, idx) => (
                                        <div key={idx} className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            {achievement.image_url ? (
                                                <img src={achievement.image_url} alt="" className="w-12 h-12 rounded bg-white object-cover shadow-sm" />
                                            ) : (
                                                <div className="w-12 h-12 rounded bg-yellow-50 flex items-center justify-center text-xl shadow-sm">
                                                    🏆
                                                </div>
                                            )}
                                            <span className="text-sm text-gray-700 font-medium">{achievement.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 栽培情報 */}
                        {(farmer.farming_method || farmer.certifications) && (
                            <div className="bg-emerald-50 rounded-xl p-4">
                                <h3 className="font-bold text-emerald-800 mb-2">栽培について</h3>
                                {farmer.farming_method && (
                                    <p className="text-sm text-emerald-700 mb-1">
                                        <span className="font-medium">栽培方法: </span> {farmer.farming_method}
                                    </p>
                                )}
                                {farmer.certifications && (
                                    <p className="text-sm text-emerald-700">
                                        <span className="font-medium">認証: </span> {farmer.certifications}
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

// YouTube URLを埋め込み用URLに変換
function convertToYouTubeEmbed(url: string): string {
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)
    if (shortMatch) {
        return `https://www.youtube.com/embed/${shortMatch[1]}`
    }

    const longMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/)
    if (longMatch) {
        return `https://www.youtube.com/embed/${longMatch[1]}`
    }

    if (url.includes('youtube.com/embed/')) {
        return url
    }

    return url
}

export default LocalFarmerDetail
