import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { farmerApi, productApi } from '@/services/api';
import { Farmer } from '@/types';
import { ArrowLeft, MapPin, ExternalLink, FileText, Loader2, Quote, Leaf, Award } from 'lucide-react';
import ProductCard from '@/components/ProductCard';

export default function FarmerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [farmer, setFarmer] = useState<Farmer | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadFarmer(parseInt(id));
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

    // Fetch Farmer's Products
    const { data: productsData } = useQuery({
        queryKey: ['farmer-products', id],
        queryFn: async () => {
            if (!id) return null;
            const res = await productApi.list({ farmer_id: parseInt(id), is_active: 1, limit: 100 });
            return res.data;
        },
        enabled: !!id
    });

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-green-600 w-8 h-8" /></div>;
    if (!farmer) return <div className="p-8 text-center text-gray-500">生産者が見つかりません</div>;

    const products = productsData?.items || [];

    const articleUrls = farmer.article_url || []
    const videoUrls = farmer.video_url || []

    const getEmbedUrl = (url: string) => {
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
            let embedUrl = url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
            if (embedUrl.includes("&")) {
                embedUrl = embedUrl.split("&")[0];
            }
            return embedUrl;
        }
        return url;
    }

    return (
        <div className="bg-white min-h-screen pb-24">
            {/* Immersive Header */}
            <div className="relative h-[40vh] w-full overflow-hidden">
                {farmer.profile_photo_url ? (
                    <img
                        src={farmer.profile_photo_url}
                        alt={farmer.name}
                        className="w-full h-full object-cover animate-fade-in"
                    />
                ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                        <Leaf className="text-slate-300 w-20 h-20" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-safe left-4 mt-4 bg-white/20 backdrop-blur-md p-2.5 rounded-full text-white hover:bg-white/30 transition-all z-20 active:scale-95"
                >
                    <ArrowLeft size={20} strokeWidth={2.5} />
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-6 text-white z-10">
                    {farmer.main_crop && (
                        <div className="inline-block px-3 py-1 bg-green-500/90 backdrop-blur-sm text-white text-xs font-bold rounded-full mb-3 shadow-sm">
                            {farmer.main_crop}の匠
                        </div>
                    )}
                    <h1 className="text-3xl font-bold mb-2 tracking-wide text-shadow-lg leading-tight">{farmer.name}</h1>
                    <div className="flex items-center gap-2 text-sm font-medium opacity-90 text-shadow-sm">
                        <MapPin size={16} className="text-green-400 fill-current" />
                        <span>{farmer.address || '兵庫県 神戸市'}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-5 -mt-6 relative z-10">
                {/* Introduction Card */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 ring-1 ring-black/5">
                    <div className="flex items-start mb-4">
                        <Quote className="text-green-100 fill-current w-8 h-8 mr-2 flex-shrink-0 -mt-2" />
                        <p className="text-gray-700 leading-7 font-medium text-[15px]">
                            {farmer.bio || '紹介文はまだありません。'}
                        </p>
                    </div>

                    {(farmer.farming_method || farmer.kodawari) && (
                        <div className="grid grid-cols-1 gap-6 mt-6 pt-6 border-t border-gray-100">
                            {farmer.farming_method && (
                                <div className="bg-green-50/50 p-4 rounded-xl border border-green-100/50">
                                    <h3 className="text-xs font-bold text-green-800 mb-2 flex items-center gap-2 uppercase tracking-wider">
                                        <Leaf size={14} /> 栽培方法
                                    </h3>
                                    <p className="text-sm text-gray-700">{farmer.farming_method}</p>
                                </div>
                            )}

                            {farmer.kodawari && (
                                <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/50">
                                    <h3 className="text-xs font-bold text-orange-800 mb-2 flex items-center gap-2 uppercase tracking-wider">
                                        <Award size={14} /> こだわり
                                    </h3>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{farmer.kodawari}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Videos Section - Prioritize visual content */}
                {videoUrls.length > 0 && (
                    <div className="mb-10">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 px-1 flex items-center gap-2">
                            <span className="w-1 h-5 bg-green-500 rounded-full"></span>
                            農園の様子
                        </h3>
                        <div className="overflow-x-auto pb-4 -mx-5 px-5 flex gap-4 no-scrollbar snap-x">
                            {videoUrls.map((url, idx) => (
                                <div key={idx} className="snap-center flex-shrink-0 w-[280px] bg-black rounded-xl shadow-md overflow-hidden relative aspect-[9/16]">
                                    <iframe
                                        src={getEmbedUrl(url)}
                                        className="w-full h-full"
                                        title={`Farmer Video ${idx + 1}`}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Products Section */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-1 h-5 bg-green-500 rounded-full"></span>
                            出品中の野菜
                        </h3>
                        <span className="text-xs text-gray-400 font-medium">{products.length}品</span>
                    </div>

                    {products.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                            {products.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-400 text-sm">現在出品中の商品はありません</p>
                        </div>
                    )}
                </div>

                {/* Articles Section */}
                {articleUrls.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 px-1 flex items-center gap-2">
                            <span className="w-1 h-5 bg-gray-800 rounded-full"></span>
                            メディア掲載
                        </h3>
                        <div className="space-y-3">
                            {articleUrls.map((url, idx) => (
                                <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-gray-100 p-2 rounded-lg text-gray-500">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800 line-clamp-2">
                                                    特集記事を読む
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{url}</p>
                                            </div>
                                        </div>
                                        <ExternalLink size={16} className="text-gray-300 mt-1" />
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Map Link */}
                {farmer.map_url && (
                    <div className="pb-8">
                        <a
                            href={farmer.map_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block w-full bg-gray-900 text-white font-bold py-4 rounded-xl text-center shadow-lg active:scale-[0.98] transition-all relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            <div className="flex items-center justify-center gap-2 relative z-10">
                                <MapPin size={18} />
                                <span>農園へのアクセス</span>
                            </div>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
