import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { farmerApi, productApi } from '@/services/api';
import { Farmer } from '@/types';
import {
    ArrowLeft, MapPin, Loader2,
    Award, Leaf, Sprout, ChefHat, Star, TrendingUp
} from 'lucide-react';
import ProductCard from '@/components/ProductCard';

// ダミーデータ（本来はDBから取得）
// こだわりブロック（食べチョク風）
const MOCK_COMMITMENTS = [
    {
        title: "土作りへの執念",
        body: "化学肥料は一切使いません。近隣の落ち葉と米ぬかを3年発酵させた独自の完熟堆肥のみを使用し、野菜本来の『エグみのない甘さ』を引き出しています。",
        image: "https://images.unsplash.com/photo-1625246333195-58197bd47a30?auto=format&fit=crop&q=80&w=300" // 土の写真
    },
    {
        title: "朝採れ・即出荷のルール",
        body: "『野菜は鮮度が命』。その当たり前を徹底するため、午前4時から収穫し、午前10時には発送を完了させます。翌日には厨房へお届けします。",
        image: "https://images.unsplash.com/photo-1595855709940-fa142475c9f3?auto=format&fit=crop&q=80&w=300" // 収穫風景
    }
];

// 実績・メディア（権威性）
const MOCK_ACHIEVEMENTS = [
    "第15回 兵庫県農業賞 グランプリ受賞",
    "テレビ朝日『人生の楽園』出演 (2024.11)",
    "神戸北野ホテル様 採用中",
    "ミシュラン掲載店『Cuisine KOBE』契約農家"
];

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
    // おすすめ商品を抽出（フラグがない場合は先頭3つ）
    const featuredProducts = products.filter(p => p.is_featured === 1);
    const displayFeatured = featuredProducts.length > 0 ? featuredProducts : products.slice(0, 3);
    const otherProducts = featuredProducts.length > 0 ? products.filter(p => p.is_featured !== 1) : products.slice(3);

    return (
        <div className="bg-gray-50 min-h-screen pb-24">
            {/* --- Hero Header --- */}
            <div className="relative bg-white">
                {/* Cover Image */}
                <div className="h-52 md:h-64 overflow-hidden relative">
                    {farmer.profile_photo_url ? (
                        <img
                            src={farmer.profile_photo_url}
                            alt="cover"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-r from-green-800 to-green-700" />
                    )}
                    <div className="absolute inset-0 bg-black/20" />

                    <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition-all z-20">
                        <ArrowLeft size={24} />
                    </button>
                </div>

                {/* Profile Info */}
                <div className="px-5 pb-4 -mt-12 relative z-10">
                    <div className="flex justify-between items-end">
                        <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-md overflow-hidden">
                            {farmer.profile_photo_url ? (
                                <img src={farmer.profile_photo_url} alt={farmer.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400"><Leaf size={32} /></div>
                            )}
                        </div>
                        {/* 配送無料バッジ（強力な訴求） */}
                        <div className="mb-2 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 shadow-sm flex items-center gap-1">
                            <TrendingUp size={14} />
                            全品送料無料
                        </div>
                    </div>

                    <div className="mt-3">
                        <h1 className="text-2xl font-bold text-gray-900">{farmer.name}</h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <div className="flex items-center gap-1">
                                <MapPin size={14} /> {farmer.address || '兵庫県'}
                            </div>
                            {farmer.main_crop && (
                                <div className="flex items-center gap-1 text-green-700 font-bold">
                                    <Sprout size={14} /> {farmer.main_crop}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Tab Navigation (Sticky) --- */}
                <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm flex">
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
            </div>

            {/* --- Main Content --- */}
            <div className="max-w-3xl mx-auto">

                {/* === TAB 1: 商品一覧 (Products) === */}
                {activeTab === 'products' && (
                    <div className="p-4 space-y-8 animate-in fade-in duration-300">
                        {/* おすすめセクション */}
                        {displayFeatured.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Star size={18} className="text-yellow-500 fill-yellow-500" />
                                    シェフへのイチオシ
                                </h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {displayFeatured.map(p => <ProductCard key={p.id} product={p} />)}
                                </div>
                            </div>
                        )}

                        {/* 通常商品 */}
                        {otherProducts.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-3">すべての野菜</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    {otherProducts.map(p => <ProductCard key={p.id} product={p} />)}
                                </div>
                            </div>
                        )}

                        {products.length === 0 && (
                            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                                現在販売中の商品はありません
                            </div>
                        )}
                    </div>
                )}

                {/* === TAB 2: ストーリー・こだわり (Story) === */}
                {activeTab === 'story' && (
                    <div className="p-4 space-y-6 animate-in fade-in duration-300">

                        {/* 1. 実績・権威性ブロック (Trust) */}
                        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-1 uppercase tracking-wider">
                                <Award size={14} /> Achievements
                            </h3>
                            <ul className="space-y-3">
                                {MOCK_ACHIEVEMENTS.map((item, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                                        <span className="font-bold text-gray-800 text-sm md:text-base">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* 2. ストーリー・挨拶 (Bio) */}
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">
                                {farmer.main_crop ? `${farmer.main_crop}作り` : '農業'}に懸ける想い
                            </h2>
                            <p className="text-gray-700 leading-8 text-[15px] whitespace-pre-wrap">
                                {farmer.bio || 'メッセージはまだありません。'}
                            </p>
                        </div>

                        {/* 3. こだわりブロック (Feature Cards - Tabechoku Style) */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-gray-900 px-1">おいしさの理由</h2>
                            {MOCK_COMMITMENTS.map((block, idx) => (
                                <div key={idx} className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm flex flex-col md:flex-row">
                                    <div className="h-40 md:w-1/3 md:h-auto bg-gray-100 relative">
                                        <img src={block.image} alt={block.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="p-5 md:w-2/3">
                                        <h3 className="text-lg font-bold text-green-800 mb-2">{block.title}</h3>
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            {block.body}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 4. シェフの声 (Social Proof) */}
                        <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                            <h2 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                                <ChefHat size={20} /> シェフからの推薦コメント
                            </h2>
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-green-100 relative">
                                <div className="text-4xl text-green-200 absolute -top-2 -left-1 font-serif">"</div>
                                <p className="text-gray-700 text-sm leading-relaxed relative z-10 italic">
                                    こちらの小松菜は、えぐみが全くなくて驚きました。
                                    生でサラダにしても最高ですし、サッと火を通した時の色の鮮やかさが違います。
                                    お客様にも『味が濃い』と評判です。
                                </p>
                                <div className="mt-3 flex items-center justify-end gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gray-200" />
                                    <span className="text-xs font-bold text-gray-500">Italian Bar R (神戸三宮)</span>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}