import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { farmerApi, productApi, followApi } from '@/services/api';
import { Farmer, Product, Commitment, Achievement } from '@/types';
import {
    ArrowLeft, Loader2, Leaf, PlayCircle, ExternalLink, ChefHat, Heart
} from 'lucide-react';
import { toast } from 'sonner';
import ProductCard from '@/components/ProductCard';

export default function FarmerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [loading, setLoading] = useState(true);

    const [isFollowed, setIsFollowed] = useState(false);
    const [followCount, setFollowCount] = useState(0);

    // タブ切り替えステート: 'products' | 'story'
    const [activeTab, setActiveTab] = useState<'products' | 'story'>('products');

    useEffect(() => {
        window.scrollTo(0, 0); // Scroll to top when loaded
        if (id) {
            loadFarmer(parseInt(id));
            loadFollowStatus(parseInt(id));
        }
    }, [id]);

    const loadFarmer = async (farmerId: number) => {
        try {
            const res = await farmerApi.getById(farmerId);
            setFarmer(res.data);
        } catch (e) {
            console.error(e);
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    const loadFollowStatus = async (farmerId: number) => {
        try {
            const res = await followApi.getFarmerStatus(farmerId);
            setIsFollowed(res.data.is_following);
            setFollowCount(res.data.count);
        } catch (e) {
            console.error("Follow status check failed", e);
        }
    }

    const handleFollow = async () => {
        if (!id) return;
        try {
            const res = await followApi.toggleFarmer(parseInt(id));
            setIsFollowed(res.data.is_following);
            setFollowCount(res.data.count);
            toast.success(res.data.is_following ? 'フォローしました' : 'フォロー解除しました');
        } catch (e) {
            console.error(e);
            toast.error('フォロー操作に失敗しました。ログインしているか確認してください。');
        }
    };

    const { data: productsData } = useQuery({
        queryKey: ['farmer-products', id],
        queryFn: async () => {
            if (!id) return null;
            return (await productApi.list({ farmer_id: parseInt(id), is_active: 1, limit: 100 })).data;
        },
        enabled: !!id
    });

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;
    if (!farmer) return <div className="p-8 text-center text-gray-500">生産者が見つかりません</div>;

    const products = productsData?.items || [];

    // データ処理
    const commitments = (farmer.commitments || []) as Commitment[];
    const videoUrls = (farmer.video_url || []) as string[];
    const articleUrls = (farmer.article_url || []) as string[];
    const achievements = (farmer.achievements || []) as Achievement[];
    const chefComments = (farmer.chef_comments || []) as any[];

    return (
        <div className="bg-white min-h-screen pb-24 font-sans">
            {/* --- Header with Back Button and Logo --- */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full border border-green-600 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="font-bold text-gray-900">{farmer.name}</span>
                </div>
                <div className="w-10" /> {/* Spacer for centering */}
            </div>

            {/* --- Cover Image --- */}
            <div className="relative h-56 w-full overflow-hidden">
                {farmer.cover_photo_url ? (
                    <img
                        src={farmer.cover_photo_url}
                        alt="cover"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-green-100 to-green-50 flex items-center justify-center">
                        <Leaf className="w-16 h-16 text-green-200" />
                    </div>
                )}

                {/* Profile Photo Overlay */}
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

            {/* --- Farmer Info --- */}
            <div className="px-4 pt-4 pb-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{farmer.name}</h1>
                {farmer.bio && (
                    <p className="text-gray-600 text-sm leading-relaxed">{farmer.bio.split('\n')[0]}</p>
                )}
            </div>

            {/* --- Tab Navigation --- */}
            <div className="sticky top-14 z-30 bg-white border-b border-gray-200 flex">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'products'
                        ? 'border-green-600 text-green-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    販売商品 ({products.length})
                </button>
                <button
                    onClick={() => setActiveTab('story')}
                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'story'
                        ? 'border-green-600 text-green-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    こだわり・実績
                </button>
            </div>

            {/* --- Main Content --- */}
            <div className="px-4 py-4">

                {/* === TAB 1: 販売商品 (Products) === */}
                {activeTab === 'products' && (
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">販売中の野菜</h2>

                        {products.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {products.map((product: Product) => (
                                    <ProductCard key={product.id} product={product} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <Leaf className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 font-medium">現在販売中の商品はありません</p>
                                <p className="text-xs text-gray-400 mt-1">次回の収穫をお待ちください</p>
                            </div>
                        )}

                        {/* フォローボタン */}
                        <div className="pt-4">
                            <button
                                onClick={handleFollow}
                                className={`w-full py-3 border-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${isFollowed
                                    ? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100'
                                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <Heart size={20} className={isFollowed ? "text-green-600 fill-green-600" : "text-gray-400"} />
                                {isFollowed ? 'フォロー中' : 'この生産者をフォローする'}
                                <span className="text-sm font-normal ml-1">({followCount})</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* === TAB 2: こだわり・実績 (Story) === */}
                {activeTab === 'story' && (
                    <div className="space-y-6">

                        {/* 紹介動画セクション（最上部） */}
                        {videoUrls.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <PlayCircle size={20} className="text-emerald-600" />
                                    紹介動画
                                </h2>
                                <div className="space-y-2">
                                    {videoUrls.map((url, idx) => (
                                        <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <PlayCircle size={18} className="text-emerald-600 shrink-0" />
                                                <span className="font-medium text-sm text-gray-700 truncate">
                                                    紹介動画を見る{videoUrls.length > 1 ? ` (${idx + 1})` : ''}
                                                </span>
                                            </div>
                                            <ExternalLink size={16} className="text-gray-400" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
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

                        {/* こだわりブロック（画像付き） */}
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

                        {/* インタビュー記事リンクセクション */}
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

                        {/* 認証・栽培方法 */}
                        {(farmer.farming_method || farmer.certifications) && (
                            <div className="bg-green-50 rounded-xl p-4">
                                <h3 className="font-bold text-green-800 mb-2">栽培について</h3>
                                {farmer.farming_method && (
                                    <p className="text-sm text-green-700 mb-1">
                                        <span className="font-medium">栽培方法:</span> {farmer.farming_method}
                                    </p>
                                )}
                                {farmer.certifications && (
                                    <p className="text-sm text-green-700">
                                        <span className="font-medium">認証:</span> {farmer.certifications}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* シェフの声 (Social Proof) */}
                        {chefComments.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <ChefHat size={20} className="text-gray-400" />
                                    シェフからの推薦
                                </h2>

                                {chefComments.map((comment, idx) => (
                                    <div key={idx} className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                                        {/* 背景装飾 */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />

                                        <div className="relative z-10">
                                            <div className="flex gap-4">
                                                <div className="text-5xl text-gray-600 font-serif leading-none">"</div>
                                                <p className="text-gray-300 text-sm leading-7 font-medium italic pt-2">
                                                    {comment.comment}
                                                </p>
                                            </div>

                                            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-700 pt-4">
                                                <div className="text-right">
                                                    <div className="text-sm font-bold text-white">{comment.chef_name}</div>
                                                    <div className="text-xs text-gray-400">{comment.restaurant_name}</div>
                                                </div>
                                                {comment.image_url ? (
                                                    <img src={comment.image_url} alt="chef" className="w-10 h-10 rounded-full border-2 border-gray-600 object-cover" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                                                        <ChefHat size={18} className="text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
}
