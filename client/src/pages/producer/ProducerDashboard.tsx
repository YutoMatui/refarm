import { useEffect, useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { producerApi } from '../../services/api';
import { Product, HarvestStatus } from '../../types';
import { Plus, ChevronRight, Loader2 } from 'lucide-react';

export default function ProducerDashboard() {
    const { farmerId } = useOutletContext<{ farmerId: number }>();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadProducts();
    }, [farmerId]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await producerApi.getProducts(farmerId);
            setProducts(res.data.items);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status?: HarvestStatus) => {
        switch (status) {
            case HarvestStatus.HARVESTABLE:
                return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">🟢 収穫可</span>;
            case HarvestStatus.WAIT_1WEEK:
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">🟡 1週間後</span>;
            case HarvestStatus.WAIT_2WEEKS:
                return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">🟠 2週間〜</span>;
            case HarvestStatus.ENDED:
                return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">🔴 終了</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">不明</span>;
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-600" /></div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">出品野菜一覧</h2>
                <Link
                    to="/producer/products/new"
                    className="bg-green-600 text-white px-4 py-2 rounded-full flex items-center shadow-lg"
                >
                    <Plus size={18} className="mr-1" />
                    新規登録
                </Link>
            </div>

            <div className="space-y-3">
                {products.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-2">登録されている野菜はありません</p>
                        <p className="text-sm text-gray-400">「新規登録」から出品しましょう</p>
                    </div>
                ) : (
                    products.map(product => (
                        <div
                            key={product.id}
                            onClick={() => navigate(`/producer/products/${product.id}/edit`)}
                            className="bg-white rounded-lg shadow p-3 flex items-center border border-gray-100 active:bg-gray-50 transition-colors"
                        >
                            {/* Image Thumbnail */}
                            <div className="w-16 h-16 bg-gray-200 rounded-md flex-shrink-0 overflow-hidden">
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No Image</div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="ml-3 flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-gray-800 truncate">{product.name}</h3>
                                    {getStatusBadge(product.harvest_status)}
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                    卸値: ¥{product.cost_price || 0} / {product.unit}
                                </div>
                            </div>

                            <ChevronRight className="text-gray-400 ml-2" size={20} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
