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
    // Simple logic for "Recommended": take up to 3 featured items, or just first 3 items
    const recommendedProducts = products.filter(p => p.is_featured === 1).slice(0, 3);
    const displayRecommended = recommendedProducts.length > 0 ? recommendedProducts : products.slice(0, 3);

    return (
        <div className="bg-gray-50 min-h-screen pb-20">
            {/* Header / Cover */}
            <div className="relative h-48 bg-green-800">
                {farmer.profile_photo_url && (
                    <img
                        src={farmer.profile_photo_url}
                        alt={farmer.name}
                        className="w-full h-full object-cover opacity-60"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 left-4 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>

                <div className="absolute bottom-4 left-4 text-white">
                    <h1 className="text-2xl font-bold mb-1">{farmer.name}</h1>
                    <div className="flex items-center gap-1 text-sm opacity-90">
                        <MapPin size={14} />
                        <span>{farmer.address || '兵庫県神戸市'}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 -mt-6 relative z-10 space-y-6">

                {/* Introduction Card */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    {farmer.main_crop && (
                        <div className="mb-3 inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                            主要作物: {farmer.main_crop}
                        </div>
                    )}
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {farmer.bio || '紹介文はまだありません。'}
                    </p>

                    {farmer.farming_method && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">栽培方法</h3>
                            <p className="text-sm text-gray-600">{farmer.farming_method}</p>
                        </div>
                    )}

                    {farmer.kodawari && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 mb-1">こだわり</h3>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{farmer.kodawari}</p>
                        </div>
                    )}
                </div>

                {/* Media Section (Article / Video) */}
                {(farmer.article_url || farmer.video_url) && (
                    <div className="space-y-4">
                        {farmer.article_url && (
                            <a
                                href={farmer.article_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
                            >
                                <div className="p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0 text-blue-600 group-hover:scale-110 transition-transform">
                                        <FileText size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">取材記事を読む</h3>
                                        <p className="text-xs text-gray-500 truncate">{farmer.article_url}</p>
                                    </div>
                                    <ExternalLink size={16} className="text-gray-400" />
                                </div>
                            </a>
                        )}

                        {farmer.video_url && (
                            <div className="bg-black rounded-xl shadow-sm overflow-hidden relative aspect-[9/16] max-w-sm mx-auto">
                                {/* Simple Embed or Link implementation */}
                                {/* Assuming YouTube Shorts or similar, displaying as link/overlay for now or iframe if possible */}
                                <iframe
                                    src={farmer.video_url.replace("youtube.com/watch?v=", "youtube.com/embed/").replace("youtu.be/", "youtube.com/embed/")}
                                    className="w-full h-full absolute inset-0"
                                    title="Farmer Video"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        )}
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
