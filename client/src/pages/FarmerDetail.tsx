import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { farmerApi, productApi } from '@/services/api';
import { Farmer } from '@/types';
import {
    ArrowLeft, MapPin, Loader2,
    Award, Leaf, Sprout, ChefHat, Star, TrendingUp, PlayCircle, ExternalLink
} from 'lucide-react';
import ProductCard from '@/components/ProductCard';

export default function FarmerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [loading, setLoading] = useState(true);

    // タブ切り替えステート: 'products' | 'story'
    const [activeTab, setActiveTab] = useState<'products' | 'story'>('products');

    useEffect(() => {
        if (id) loadFarmer(parseInt(id));
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
    const featuredProducts = products.filter(p => p.is_featured === 1);
    const displayFeatured = featuredProducts.length > 0 ? featuredProducts : products.slice(0, 3);
    const otherProducts = featuredProducts.length > 0 ? products.filter(p => p.is_featured !== 1) : products.slice(3);

    // データ処理
    const commitments = (farmer.commitments || []) as any[];
    const achievements = (farmer.achievements || []) as string[]; // Assume simple string array for now
    const chefComments = (farmer.chef_comments || []) as any[];

    return (
        <div className="bg-gray-50 min-h-screen pb-24 font-sans">
            {/* --- Hero Header --- */}
            <div className="relative bg-white">
                {/* Cover Image */}
                <div className="h-64 md:h-80 overflow-hidden relative">
                    {farmer.cover_photo_url ? (
                        <img
                            src={farmer.cover_photo_url}
                            alt="cover"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-r from-gray-800 to-gray-700" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition-all z-20">
                        <ArrowLeft size={24} />
                    </button>
                </div>

                {/* Profile Info */}
                <div className="px-5 pb-6 -mt-20 relative z-10">
                    <div className="flex justify-between items-end mb-4">
                        <div className="w-28 h-28 rounded-2xl border-4 border-white bg-white shadow-xl overflow-hidden relative">
                            {farmer.profile_photo_url ? (
                                <img src={farmer.profile_photo_url} alt={farmer.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400"><Leaf size={32} /></div>
                            )}
                        </div>
                        {/* 配送無料バッジ */}
                        <div className="mb-3 bg-orange-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 animate-pulse">
                            <TrendingUp size={14} />
                            全品送料無料
                        </div>
                    </div>

                    <div>
                        <h1 className="text-3xl font-extrabold text-white drop-shadow-sm mb-1">{farmer.name}</h1>
                        <div className="flex items-center gap-4 text-sm text-gray-200">
                            <div className="flex items-center gap-1">
                                <MapPin size={14} className="text-gray-300" /> {farmer.address || '兵庫県'}
                            </div>
                            {farmer.main_crop && (
                                <div className="flex items-center gap-1 text-green-300 font-bold bg-green-900/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
                                    <Sprout size={14} /> {farmer.main_crop}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Tab Navigation (Sticky) --- */}
                <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm flex">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors relative ${activeTab === 'products'
                                ? 'border-green-600 text-green-800'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        販売商品 ({products.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('story')}
                        className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'story'
                                ? 'border-green-600 text-green-800'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        こだわり・実績
                    </button>
                </div>
            </div>

            {/* --- Main Content --- */}
            <div className="max-w-3xl mx-auto">

                {/* === TAB 1: 商品一覧 (Products) === */}
                {activeTab === 'products' && (
                    <div className="p-5 space-y-10 animate-in fade-in duration-300">
                        {/* おすすめセクション */}
                        {displayFeatured.length > 0 && (
                            <div>
                                <h2 className="text-xl font-extrabold text-gray-800 mb-4 flex items-center gap-2">
                                    <div className="bg-yellow-100 p-1.5 rounded-lg">
                                        <Star size={20} className="text-yellow-600 fill-yellow-600" />
                                    </div>
                                    <span className="bg-gradient-to-r from-yellow-600 to-orange-500 bg-clip-text text-transparent">
                                        {farmer.name}のおすすめ
                                    </span>
                                </h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {displayFeatured.map(p => <ProductCard key={p.id} product={p} />)}
                                </div>
                            </div>
                        )}

                        {/* 通常商品 */}
                        {otherProducts.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-green-600 pl-3">
                                    すべての野菜
                                </h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {otherProducts.map(p => <ProductCard key={p.id} product={p} />)}
                                </div>
                            </div>
                        )}

                        {products.length === 0 && (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 mx-4">
                                <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-bold">現在販売中の商品はありません</p>
                                <p className="text-xs text-gray-400 mt-1">次回の収穫をお待ちください</p>
                            </div>
                        )}
                    </div>
                )}

                {/* === TAB 2: ストーリー・こだわり (Story) === */}
                {activeTab === 'story' && (
                    <div className="p-5 space-y-8 animate-in fade-in duration-300">

                        {/* 1. 実績・権威性ブロック (Trust) */}
                        {achievements.length > 0 && (
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
                                <h3 className="text-xs font-extrabold text-gray-400 mb-4 flex items-center gap-1 uppercase tracking-wider">
                                    <Award size={14} /> Achievements
                                </h3>
                                <ul className="space-y-3 relative z-10">
                                    {achievements.map((item, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0 shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
                                            <span className="font-bold text-gray-800 text-sm md:text-base leading-relaxed">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 2. ストーリー・挨拶 (Bio) */}
                        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                            <h2 className="text-xl font-extrabold text-gray-900 mb-6 border-b pb-4 border-gray-100">
                                {farmer.main_crop ? `${farmer.main_crop}作り` : '農業'}に懸ける想い
                            </h2>
                            <div className="text-gray-700 leading-8 text-[15px] whitespace-pre-wrap font-medium">
                                {farmer.bio || 'メッセージはまだありません。'}
                            </div>
                        </div>

                        {/* 3. こだわりブロック (Feature Cards) */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-extrabold text-gray-900 px-1">おいしさの理由</h2>
                            {commitments.length > 0 ? commitments.map((block, idx) => (
                                <div key={idx} className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg flex flex-col md:flex-row group hover:border-green-300 transition-colors">
                                    {block.image && (
                                        <div className="h-48 md:w-2/5 md:h-auto bg-gray-100 relative overflow-hidden">
                                            <img src={block.image} alt={block.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                        </div>
                                    )}
                                    <div className="p-6 md:w-3/5 flex flex-col justify-center">
                                        <h3 className="text-lg font-bold text-green-800 mb-3">{block.title}</h3>
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            {block.body}
                                        </p>

                                        {/* メディアリンクがあれば表示 */}
                                        {(block.video_url || block.article_url) && (
                                            <div className="mt-4 flex gap-2">
                                                {block.video_url && (
                                                    <a href={block.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors">
                                                        <PlayCircle size={14} /> 動画を見る
                                                    </a>
                                                )}
                                                {block.article_url && (
                                                    <a href={block.article_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
                                                        <ExternalLink size={14} /> 記事を読む
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center text-gray-400 py-8 bg-white rounded-xl border border-dashed">こだわり情報はまだありません</div>
                            )}
                        </div>

                        {/* 4. シェフの声 (Social Proof) */}
                        {chefComments.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="text-xl font-extrabold text-gray-900 px-1 flex items-center gap-2">
                                    <ChefHat size={24} className="text-gray-400" />
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
