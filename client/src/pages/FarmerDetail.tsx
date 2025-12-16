import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { farmerApi, productApi } from '@/services/api';
import { Farmer } from '@/types';
import { ArrowLeft, MapPin, ExternalLink, FileText, Loader2 } from 'lucide-react';
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

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-600" /></div>;
    if (!farmer) return <div className="p-8 text-center">生産者が見つかりません</div>;

    const products = productsData?.items || [];
    const recommendedProducts = products.filter(p => p.is_featured === 1).slice(0, 3);
    const displayRecommended = recommendedProducts.length > 0 ? recommendedProducts : products.slice(0, 3);

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
        <div className="bg-gray-50 min-h-screen pb-20">
            {/* Header / Cover */}
            <div className="relative h-64 bg-green-900">
                {farmer.profile_photo_url && (
                    <img
                        src={farmer.profile_photo_url}
                        alt={farmer.name}
                        className="w-full h-full object-cover opacity-70"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition-colors z-20"
                >
                    <ArrowLeft size={24} />
                </button>

                <div className="absolute bottom-8 left-4 right-4 text-white z-10">
                    <h1 className="text-3xl font-bold mb-2 text-shadow">{farmer.name}</h1>
                    <div className="flex items-center gap-2 text-sm font-medium opacity-90">
                        <MapPin size={16} />
                        <span>{farmer.address || '住所未設定'}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">

                {/* Introduction Card */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    {farmer.main_crop && (
                        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 text-sm font-bold rounded-full border border-green-100">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            主要作物: {farmer.main_crop}
                        </div>
                    )}
                    <p className="text-gray-700 leading-loose whitespace-pre-wrap text-[15px]">
                        {farmer.bio || '紹介文はまだありません。'}
                    </p>

                    {(farmer.farming_method || farmer.kodawari) && <div className="my-6 border-t border-gray-100"></div>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {farmer.farming_method && (
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                                    栽培方法
                                </h3>
                                <p className="text-sm text-gray-600 leading-relaxed">{farmer.farming_method}</p>
                            </div>
                        )}

                        {farmer.kodawari && (
                            <div className={farmer.farming_method ? "" : "md:col-span-2"}>
                                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                                    こだわり
                                </h3>
                                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{farmer.kodawari}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Articles Section */}
                {articleUrls.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-gray-500" />
                                取材記事
                            </h3>
                        </div>
                        <div className="grid gap-3">
                            {articleUrls.map((url, idx) => (
                                <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:border-green-500 hover:shadow-md transition-all duration-300"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                                            <span className="font-bold text-sm">{(idx + 1).toString().padStart(2, '0')}</span>
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 group-hover:text-green-700 transition-colors flex items-center gap-2">
                                                この記事を読む
                                                <ExternalLink size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px] sm:max-w-xs">{url}</div>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center text-gray-300 group-hover:bg-green-600 group-hover:border-green-600 group-hover:text-white transition-all">
                                        <ExternalLink size={14} />
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Videos Section */}
                {videoUrls.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-gray-900 px-1">紹介動画</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {videoUrls.map((url, idx) => (
                                <div key={idx} className="bg-black rounded-xl shadow-sm overflow-hidden relative aspect-[9/16] w-full max-w-sm mx-auto">
                                    <iframe
                                        src={getEmbedUrl(url)}
                                        className="w-full h-full absolute inset-0"
                                        title={`Farmer Video ${idx + 1}`}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recommended Products */}
                {displayRecommended.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-3 px-1">おすすめの野菜</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {displayRecommended.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </div>
                )}

                {/* All Products */}
                {products.length > 0 && (
                    <div className="pt-4">
                        <h2 className="text-lg font-bold text-gray-900 mb-3 px-1">現在販売中の野菜</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {products.map(product => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Map Link */}
                {farmer.map_url && (
                    <div className="pt-4">
                        <a
                            href={farmer.map_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                        >
                            <MapPin size={18} />
                            農園の場所を地図で見る
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
